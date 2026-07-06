/**
 * 影響力（docs/01 §4.3、docs/05 §4）。
 * goodwillFromTrade：交易時累積商譽點，寫入 PortInfluence.goodwill（M3 起）。
 * settleInfluence：每 tick 的完整結算——衰減、商譽轉化、擠壓回 100（M7 起）。
 */
import { BALANCE } from "../content/constants";

/** 邊際遞減：交易額越高、現有份額越高，累積速度越慢。 */
export function goodwillFromTrade(tradeValue: number, currentSharePercent: number): number {
  const marginal = Math.max(0, 1 - currentSharePercent / 120);
  return BALANCE.GOODWILL_K * Math.sqrt(Math.max(0, tradeValue)) * marginal;
}

/** 港口投資帶來的立即影響力（docs/01 §4.3）：已有份額越高，同樣金額買到的份額越少。 */
export function investmentGain(amount: number, currentSharePercent: number): number {
  const cost = BALANCE.INVESTMENT_COST_BASE * (1 + currentSharePercent / 25);
  return Math.max(0, amount / cost);
}

export interface InfluenceEntry {
  guildId: string;
  /** LOCAL 勢力最先被擠壓（docs/01 §4.3：「在地勢力最軟」） */
  isLocal: boolean;
  share: number;
  goodwill: number;
}

const DP = 100; // 兩位小數的定點運算基數，避免浮點誤差累積

function round2(n: number): number {
  return Math.round(n * DP) / DP;
}

/**
 * 單一港口一個 tick 的影響力結算：
 * 1) 自然衰減 2) 商譽轉化為份額（並消耗商譽） 3) 擠壓回總和 ≤ 100。
 * 純函式、不含 IO；呼叫端負責讀寫 DB。回傳陣列與輸入同序、同長度。
 */
export function settleInfluence(entries: readonly InfluenceEntry[]): InfluenceEntry[] {
  if (entries.length === 0) return [];

  // 1) 衰減 + 2) 商譽轉化（轉化的商譽從池中扣除，避免無限複利）
  let updated = entries.map((e) => {
    const decayed = e.share * (1 - BALANCE.INFLUENCE_DECAY);
    const delta = e.goodwill * BALANCE.GOODWILL_CONVERT_RATE;
    return {
      guildId: e.guildId,
      isLocal: e.isLocal,
      share: Math.max(0, decayed + delta),
      goodwill: Math.max(0, e.goodwill - delta),
    };
  });

  // 3) 擠壓：總和超過 100 時，先壓 LOCAL，壓到 0 仍不夠再依比例壓其他勢力
  const total = updated.reduce((acc, e) => acc + e.share, 0);
  if (total > 100) {
    let excess = total - 100;
    updated = updated.map((e) => {
      if (!e.isLocal || excess <= 0) return e;
      const take = Math.min(e.share, excess);
      excess -= take;
      return { ...e, share: e.share - take };
    });

    if (excess > 0) {
      const squeezable = updated.filter((e) => !e.isLocal && e.share > 0);
      const squeezableTotal = squeezable.reduce((acc, e) => acc + e.share, 0);
      if (squeezableTotal > 0) {
        updated = updated.map((e) => {
          if (e.isLocal || e.share <= 0) return e;
          const ratio = e.share / squeezableTotal;
          return { ...e, share: Math.max(0, e.share - excess * ratio) };
        });
      }
    }
  }

  const rounded = updated.map((e) => ({ ...e, share: round2(e.share), goodwill: round2(e.goodwill) }));

  // 每筆獨立四捨五入到兩位小數，理論總和 ≤100 的量在極端情況下可能被捨入推過 100
  // （例如 3 筆都恰好在 .xx5 邊界各自進位 +0.01，合計可超出 100 幾分）。
  // 因此在這裡做最後修正：超出的部分從目前份額最大的一筆扣回，維持「總和 ≤100」這個
  // 硬性不變量（docs/05 §4 明確要求單測驗證）。
  const roundedTotal = rounded.reduce((acc, e) => acc + e.share, 0);
  if (roundedTotal > 100) {
    const overshoot = round2(roundedTotal - 100);
    const largest = rounded.reduce((a, b) => (b.share > a.share ? b : a), rounded[0]);
    largest.share = round2(Math.max(0, largest.share - overshoot));
  }

  return rounded;
}
