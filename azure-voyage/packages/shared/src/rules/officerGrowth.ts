/**
 * 航海士經驗成長與職位效果（docs/01 §4.5，M23）。
 * 純函式，供 API 層與測試共用；經驗值累積、屬性成長、職位加成係數的計算
 * 全部走這裡，不在業務代碼裡重算公式。
 */
import { BALANCE } from "../content/constants";
import type { OfficerStats } from "../content/officersPool";

const STAT_KEYS: (keyof OfficerStats)[] = ["lead", "nav", "combat", "trade", "lore"];

export function officerLevel(exp: number): number {
  return Math.floor(Math.max(0, exp) / BALANCE.OFFICER_EXP_PER_LEVEL);
}

export interface ExpGainResult {
  exp: number;
  stats: OfficerStats;
  levelsGained: number;
}

/** 獲得經驗值後的新狀態：跨過等級門檻時，全體屬性 +1（上限 100），可能一次連跳多級。 */
export function applyExpGain(currentExp: number, gain: number, currentStats: OfficerStats): ExpGainResult {
  const exp = currentExp + gain;
  const levelsGained = officerLevel(exp) - officerLevel(currentExp);
  if (levelsGained <= 0) return { exp, stats: currentStats, levelsGained: 0 };

  const stats = { ...currentStats };
  for (const key of STAT_KEYS) {
    stats[key] = Math.min(100, stats[key] + levelsGained);
  }
  return { exp, stats, levelsGained };
}

/** 副官（FIRST_MATE）：欠薪忠誠度懲罰的減免比例（0–MAX），無副官時傳 undefined lead。 */
export function firstMateLoyaltyMitigation(lead: number | undefined): number {
  if (lead === undefined) return 0;
  return Math.min(BALANCE.FIRST_MATE_LOYALTY_MITIGATION_MAX, lead * BALANCE.FIRST_MATE_LOYALTY_MITIGATION_PER_LEAD);
}

/** 炮術長（GUNNER）：砲擊傷害加成比例（0–MAX）。 */
export function gunnerDamageBonus(combat: number | undefined): number {
  if (combat === undefined) return 0;
  return Math.min(BALANCE.GUNNER_DAMAGE_BONUS_MAX, combat * BALANCE.GUNNER_DAMAGE_BONUS_PER_COMBAT);
}

/** 會計長（PURSER）：買賣折扣加成比例（0–MAX），與影響力折扣疊加。 */
export function purserTradeBonus(trade: number | undefined): number {
  if (trade === undefined) return 0;
  return Math.min(BALANCE.PURSER_TRADE_BONUS_MAX, trade * BALANCE.PURSER_TRADE_BONUS_PER_TRADE_STAT);
}

/** 瞭望員（LOOKOUT）：風暴／海賊遭遇機率降低比例（0–MAX）。 */
export function lookoutDangerReduction(lore: number | undefined): number {
  if (lore === undefined) return 0;
  return Math.min(BALANCE.LOOKOUT_DANGER_REDUCTION_MAX, lore * BALANCE.LOOKOUT_DANGER_REDUCTION_PER_LORE);
}
