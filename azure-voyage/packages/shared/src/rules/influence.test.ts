import { describe, expect, it } from "vitest";
import { goodwillFromTrade } from "./influence";

describe("goodwillFromTrade", () => {
  it("increases with trade value", () => {
    expect(goodwillFromTrade(1000, 0)).toBeGreaterThan(goodwillFromTrade(100, 0));
  });

  it("has diminishing returns as current share grows", () => {
    const low = goodwillFromTrade(1000, 5);
    const high = goodwillFromTrade(1000, 80);
    expect(high).toBeLessThan(low);
  });

  it("never goes negative even at/above the saturation share", () => {
    expect(goodwillFromTrade(1000, 120)).toBeGreaterThanOrEqual(0);
    expect(goodwillFromTrade(1000, 500)).toBe(0);
  });

  it("is zero for zero trade value", () => {
    expect(goodwillFromTrade(0, 10)).toBe(0);
  });
});
