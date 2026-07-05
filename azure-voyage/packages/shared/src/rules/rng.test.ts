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
