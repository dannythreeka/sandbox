import { describe, expect, it } from "vitest";
import { BALANCE } from "../content/constants";
import { captainTitleForLevel } from "../content/captainTitles";
import {
  applyCaptainExpGain,
  captainCombatDamageBonus,
  captainDangerReduction,
  captainLevel,
  captainLoyaltyMitigation,
  captainNavSpeedBonus,
  captainTradeBonus,
} from "./captainGrowth";

const STATS = { lead: 50, nav: 50, combat: 50, trade: 50, lore: 50 };

describe("captainLevel", () => {
  it("is 0 below the first threshold and increases every CAPTAIN_EXP_PER_LEVEL", () => {
    expect(captainLevel(0)).toBe(0);
    expect(captainLevel(BALANCE.CAPTAIN_EXP_PER_LEVEL - 1)).toBe(0);
    expect(captainLevel(BALANCE.CAPTAIN_EXP_PER_LEVEL)).toBe(1);
    expect(captainLevel(BALANCE.CAPTAIN_EXP_PER_LEVEL * 3)).toBe(3);
  });
});

describe("applyCaptainExpGain", () => {
  it("accumulates exp without leveling up below the threshold", () => {
    const result = applyCaptainExpGain(0, BALANCE.CAPTAIN_EXP_PER_LEVEL - 1, STATS);
    expect(result.levelsGained).toBe(0);
    expect(result.stats).toEqual(STATS);
  });

  it("levels up and bumps every stat by 1 per level when crossing a threshold", () => {
    const result = applyCaptainExpGain(0, BALANCE.CAPTAIN_EXP_PER_LEVEL, STATS);
    expect(result.levelsGained).toBe(1);
    for (const key of Object.keys(STATS) as (keyof typeof STATS)[]) {
      expect(result.stats[key]).toBe(STATS[key] + 1);
    }
  });

  it("can jump multiple levels in a single large gain", () => {
    const result = applyCaptainExpGain(0, BALANCE.CAPTAIN_EXP_PER_LEVEL * 3, STATS);
    expect(result.levelsGained).toBe(3);
    expect(result.stats.nav).toBe(STATS.nav + 3);
  });

  it("caps stat growth at 100", () => {
    const nearCap = { lead: 99, nav: 99, combat: 99, trade: 99, lore: 99 };
    const result = applyCaptainExpGain(0, BALANCE.CAPTAIN_EXP_PER_LEVEL * 5, nearCap);
    for (const key of Object.keys(nearCap) as (keyof typeof nearCap)[]) {
      expect(result.stats[key]).toBeLessThanOrEqual(100);
    }
  });
});

describe("captain bonus coefficients", () => {
  it("captainNavSpeedBonus grows with nav, bounded", () => {
    expect(captainNavSpeedBonus(0)).toBe(0);
    expect(captainNavSpeedBonus(50)).toBeGreaterThan(0);
    expect(captainNavSpeedBonus(100)).toBeLessThanOrEqual(BALANCE.CAPTAIN_NAV_SPEED_BONUS_MAX);
  });

  it("captainCombatDamageBonus grows with combat, bounded", () => {
    expect(captainCombatDamageBonus(0)).toBe(0);
    expect(captainCombatDamageBonus(50)).toBeGreaterThan(0);
    expect(captainCombatDamageBonus(100)).toBeLessThanOrEqual(BALANCE.CAPTAIN_COMBAT_DAMAGE_BONUS_MAX);
  });

  it("captainTradeBonus grows with trade, bounded", () => {
    expect(captainTradeBonus(0)).toBe(0);
    expect(captainTradeBonus(50)).toBeGreaterThan(0);
    expect(captainTradeBonus(100)).toBeLessThanOrEqual(BALANCE.CAPTAIN_TRADE_BONUS_MAX);
  });

  it("captainDangerReduction grows with lore, bounded", () => {
    expect(captainDangerReduction(0)).toBe(0);
    expect(captainDangerReduction(50)).toBeGreaterThan(0);
    expect(captainDangerReduction(100)).toBeLessThanOrEqual(BALANCE.CAPTAIN_DANGER_REDUCTION_MAX);
  });

  it("captainLoyaltyMitigation grows with lead, bounded", () => {
    expect(captainLoyaltyMitigation(0)).toBe(0);
    expect(captainLoyaltyMitigation(50)).toBeGreaterThan(0);
    expect(captainLoyaltyMitigation(100)).toBeLessThanOrEqual(BALANCE.CAPTAIN_LEAD_LOYALTY_MITIGATION_MAX);
  });
});

describe("captainTitleForLevel", () => {
  it("starts at the entry title and unlocks higher titles at their thresholds", () => {
    expect(captainTitleForLevel(0)).toBe("見習船長");
    expect(captainTitleForLevel(2)).toBe("見習船長");
    expect(captainTitleForLevel(3)).toBe("自由船長");
    expect(captainTitleForLevel(20)).toBe("蒼瀾傳說");
    expect(captainTitleForLevel(999)).toBe("蒼瀾傳說");
  });
});
