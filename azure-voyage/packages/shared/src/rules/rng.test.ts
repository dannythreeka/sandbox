import { describe, expect, it } from "vitest";
import { deriveSeed, mulberry32, Rng, tickRng } from "./rng";

describe("rng", () => {
  it("is deterministic: same seed, same sequence", () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 100; i++) {
      expect(a.float()).toBe(b.float());
    }
  });

  it("different seeds diverge", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });

  it("int stays within inclusive bounds", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("deriveSeed depends on stream order and values", () => {
    expect(deriveSeed(42, 1, 2)).not.toBe(deriveSeed(42, 2, 1));
    expect(deriveSeed(42, 1)).not.toBe(deriveSeed(42, 2));
    expect(deriveSeed(42, 1, 2)).toBe(deriveSeed(42, 1, 2));
  });

  it("does not degenerate into a constant when the base seed equals a stream value", () => {
    // 迴歸測試（M5）：舊版 deriveSeed 用 h ^ s 直接混合，一旦呼叫端剛好傳入
    // seed === streams[0]（例如 deriveSeed(worldSeed, tick, ...) 恰好 worldSeed===tick）
    // 就會讓 h ^ s 歸零，後續結果變成與 seed 完全無關的常數。
    const outputs = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      outputs.add(deriveSeed(seed, seed, 12345));
    }
    expect(outputs.size).toBeGreaterThan(40);
  });

  it("always fits a signed 32-bit integer (safe for a Postgres Int column)", () => {
    // 迴歸測試（M5）：deriveSeed 曾回傳完整無號 32-bit（可達 4294967295），
    // 存進 Battle.seed（有號 INT4，上限 2147483647）時約一半機率會直接讓寫入炸掉。
    for (let seed = 0; seed < 200; seed++) {
      const derived = deriveSeed(seed, seed * 7 + 3, seed * 13);
      expect(derived).toBeGreaterThanOrEqual(0);
      expect(derived).toBeLessThanOrEqual(2147483647);
    }
  });

  it("tickRng gives independent deterministic streams per tick", () => {
    expect(tickRng(9, 1).float()).toBe(tickRng(9, 1).float());
    expect(tickRng(9, 1).float()).not.toBe(tickRng(9, 2).float());
  });

  it("shuffle keeps all elements and does not mutate input", () => {
    const rng = new Rng(3);
    const input = [1, 2, 3, 4, 5];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
