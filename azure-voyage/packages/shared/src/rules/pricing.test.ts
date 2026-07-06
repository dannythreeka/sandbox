import { describe, expect, it } from "vitest";
import {
  computeMarketPrice,
  effectiveBuyPrice,
  effectiveSellPrice,
  influenceDiscount,
  regenStock,
  supplyDemandFactor,
} from "./pricing";

describe("supplyDemandFactor", () => {
  it("rises above 1 when stock is scarce and falls below 1 when abundant", () => {
    expect(supplyDemandFactor(50, 100, "FOOD")).toBeGreaterThan(1);
    expect(supplyDemandFactor(200, 100, "FOOD")).toBeLessThan(1);
    expect(supplyDemandFactor(100, 100, "FOOD")).toBeCloseTo(1, 5);
  });

  it("is monotonically decreasing in stock", () => {
    const a = supplyDemandFactor(10, 100, "LUXURY");
    const b = supplyDemandFactor(50, 100, "LUXURY");
    const c = supplyDemandFactor(150, 100, "LUXURY");
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it("luxury/spice react more sharply than food (higher elasticity)", () => {
    const foodFactor = supplyDemandFactor(20, 100, "FOOD");
    const luxuryFactor = supplyDemandFactor(20, 100, "LUXURY");
    expect(luxuryFactor).toBeGreaterThan(foodFactor);
  });

  it("clamps to [0.4, 3.0]", () => {
    expect(supplyDemandFactor(1, 100000, "SPICE")).toBeLessThanOrEqual(3.0);
    expect(supplyDemandFactor(100000, 1, "SPICE")).toBeGreaterThanOrEqual(0.4);
  });
});

describe("computeMarketPrice", () => {
  it("never returns less than 1", () => {
    const price = computeMarketPrice({ basePrice: 10, stock: 100000, baseStock: 1, category: "FOOD" });
    expect(price).toBeGreaterThanOrEqual(1);
  });
});

describe("influenceDiscount", () => {
  it("steps by 1% per 10% share, capped at 8%", () => {
    expect(influenceDiscount(0)).toBe(0);
    expect(influenceDiscount(9)).toBe(0);
    expect(influenceDiscount(10)).toBeCloseTo(0.01);
    expect(influenceDiscount(55)).toBeCloseTo(0.05);
    expect(influenceDiscount(100)).toBe(0.08);
  });
});

describe("effectiveBuyPrice / effectiveSellPrice", () => {
  it("buy price decreases and sell price increases with influence share", () => {
    const noShare = effectiveBuyPrice(100, 0);
    const highShare = effectiveBuyPrice(100, 80);
    expect(highShare).toBeLessThan(noShare);

    const sellNoShare = effectiveSellPrice(100, 0);
    const sellHighShare = effectiveSellPrice(100, 80);
    expect(sellHighShare).toBeGreaterThan(sellNoShare);
  });

  it("sell price is always below market price (spread)", () => {
    expect(effectiveSellPrice(100, 0)).toBeLessThan(100);
  });
});

describe("regenStock", () => {
  it("moves stock toward baseStock without overshooting in one tick", () => {
    const up = regenStock(50, 100);
    expect(up).toBeGreaterThan(50);
    expect(up).toBeLessThan(100);

    const down = regenStock(150, 100);
    expect(down).toBeLessThan(150);
    expect(down).toBeGreaterThan(100);
  });

  it("is a no-op at equilibrium", () => {
    expect(regenStock(100, 100)).toBe(100);
  });
});
