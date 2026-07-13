import { describe, expect, it } from "vitest";
import { BALANCE } from "../content/constants";
import {
  applyExpGain,
  firstMateLoyaltyMitigation,
  gunnerDamageBonus,
  lookoutDangerReduction,
  officerLevel,
  purserTradeBonus,
} from "./officerGrowth";

const STATS = { lead: 50, nav: 50, combat: 50, trade: 50, lore: 50 };

describe("officerLevel", () => {
  it("is 0 below the first threshold and increases every OFFICER_EXP_PER_LEVEL", () => {
    expect(officerLevel(0)).toBe(0);
    expect(officerLevel(BALANCE.OFFICER_EXP_PER_LEVEL - 1)).toBe(0);
    expect(officerLevel(BALANCE.OFFICER_EXP_PER_LEVEL)).toBe(1);
    expect(officerLevel(BALANCE.OFFICER_EXP_PER_LEVEL * 3)).toBe(3);
  });
});

describe("applyExpGain", () => {
  it("accumulates exp without leveling up below the threshold", () => {
    const result = applyExpGain(0, BALANCE.OFFICER_EXP_PER_LEVEL - 1, STATS);
    expect(result.levelsGained).toBe(0);
    expect(result.stats).toEqual(STATS);
    expect(result.exp).toBe(BALANCE.OFFICER_EXP_PER_LEVEL - 1);
  });

  it("levels up and bumps every stat by 1 per level when crossing a threshold", () => {
    const result = applyExpGain(0, BALANCE.OFFICER_EXP_PER_LEVEL, STATS);
    expect(result.levelsGained).toBe(1);
    for (const key of Object.keys(STATS) as (keyof typeof STATS)[]) {
      expect(result.stats[key]).toBe(STATS[key] + 1);
    }
  });

  it("can jump multiple levels in a single large gain", () => {
    const result = applyExpGain(0, BALANCE.OFFICER_EXP_PER_LEVEL * 3, STATS);
    expect(result.levelsGained).toBe(3);
    expect(result.stats.lead).toBe(STATS.lead + 3);
  });

  it("caps stat growth at 100", () => {
    const nearCap = { lead: 99, nav: 99, combat: 99, trade: 99, lore: 99 };
    const result = applyExpGain(0, BALANCE.OFFICER_EXP_PER_LEVEL * 5, nearCap);
    for (const key of Object.keys(nearCap) as (keyof typeof nearCap)[]) {
      expect(result.stats[key]).toBeLessThanOrEqual(100);
    }
  });
});

describe("role buff coefficients", () => {
  it("firstMateLoyaltyMitigation is 0 without a first mate and grows with lead, bounded", () => {
    expect(firstMateLoyaltyMitigation(undefined)).toBe(0);
    expect(firstMateLoyaltyMitigation(50)).toBeGreaterThan(0);
    expect(firstMateLoyaltyMitigation(100)).toBeLessThanOrEqual(BALANCE.FIRST_MATE_LOYALTY_MITIGATION_MAX);
  });

  it("gunnerDamageBonus is 0 without a gunner and grows with combat, bounded", () => {
    expect(gunnerDamageBonus(undefined)).toBe(0);
    expect(gunnerDamageBonus(50)).toBeGreaterThan(0);
    expect(gunnerDamageBonus(100)).toBeLessThanOrEqual(BALANCE.GUNNER_DAMAGE_BONUS_MAX);
  });

  it("purserTradeBonus is 0 without a purser and grows with trade, bounded", () => {
    expect(purserTradeBonus(undefined)).toBe(0);
    expect(purserTradeBonus(50)).toBeGreaterThan(0);
    expect(purserTradeBonus(100)).toBeLessThanOrEqual(BALANCE.PURSER_TRADE_BONUS_MAX);
  });

  it("lookoutDangerReduction is 0 without a lookout and grows with lore, bounded", () => {
    expect(lookoutDangerReduction(undefined)).toBe(0);
    expect(lookoutDangerReduction(50)).toBeGreaterThan(0);
    expect(lookoutDangerReduction(100)).toBeLessThanOrEqual(BALANCE.LOOKOUT_DANGER_REDUCTION_MAX);
  });
});
