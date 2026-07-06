import { describe, expect, it } from "vitest";
import { explorationSuccessChance } from "./exploration";

describe("explorationSuccessChance", () => {
  it("increases with lore above the requirement", () => {
    expect(explorationSuccessChance(80, 40)).toBeGreaterThan(explorationSuccessChance(40, 40));
  });

  it("clamps to [0.05, 0.95]", () => {
    expect(explorationSuccessChance(0, 100)).toBeGreaterThanOrEqual(0.05);
    expect(explorationSuccessChance(100, 0)).toBeLessThanOrEqual(0.95);
  });

  it("still gives a non-trivial chance exactly at the threshold", () => {
    expect(explorationSuccessChance(40, 40)).toBeCloseTo(0.35);
  });
});
