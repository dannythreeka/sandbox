/**
 * 種子化隨機數（docs/03 §2、docs/05）。
 * 一切遊戲隨機都必須經過這裡：同 seed 同結果，tick 與戰鬥才能重放與測試。
 */

/** mulberry32：快速、品質足夠的 32-bit PRNG。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 將主 seed 與若干串流編號混合出子 seed（例：tick 編號、戰鬥回合）。
 * 注意：折入的每個 stream 值先經過 imul 轉換再 XOR 進累積值，而不是直接
 * `h ^ s`——否則當呼叫端剛好傳入 seed === 某個 stream 值時，h ^ s 會整個
 * 歸零、後續混合結果會與該值本身無關而變成常數（曾在 EncounterService 的
 * 遭遇機率測試中實際觸發過這個退化案例）。
 *
 * 回傳值遮罩到 31-bit（& 0x7fffffff）：deriveSeed 的結果經常直接存進 DB 的
 * 有號 32-bit Int 欄位（例如 Battle.seed），若回傳完整無號 32-bit（可達
 * 4294967295）有一半機率會超出有號 INT4 範圍而讓寫入直接炸掉（曾在戰鬥
 * seed 寫入 Postgres 時實際觸發過）。少 1 bit 熵對遊戲用途的隨機性毫無影響。
 */
export function deriveSeed(seed: number, ...streams: number[]): number {
  let h = seed >>> 0;
  for (const s of streams) {
    const k = Math.imul(s >>> 0, 0x9e3779b1) >>> 0;
    h = (h ^ k) >>> 0;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return (h >>> 0) & 0x7fffffff;
}

/** 便利包裝：帶常用抽樣方法的隨機來源。 */
export class Rng {
  private readonly next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  /** [0, 1) */
  float(): number {
    return this.next();
  }

  /** 整數 [min, max]（含端點） */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** true 機率 = p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick on empty array");
    return items[this.int(0, items.length - 1)];
  }

  /** Fisher–Yates；回傳新陣列，不動原本 */
  shuffle<T>(items: readonly T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** 抽 n 個不重複元素 */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.min(n, items.length));
  }
}

/** 世界 tick 用的派生 RNG（docs/05 §1） */
export function tickRng(worldSeed: number, tick: number): Rng {
  return new Rng(deriveSeed(worldSeed, 0x7101c, tick));
}
