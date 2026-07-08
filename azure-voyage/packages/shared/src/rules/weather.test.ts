import { describe, expect, it } from "vitest";
import { BALANCE } from "../content/constants";
import { REGIONS } from "../content/regions";
import {
  weatherAtTick,
  weatherEncounterMult,
  weatherExplorationMult,
  weatherSpeedMult,
  weatherStormEventMult,
  WEATHER_KINDS,
} from "./weather";

describe("weatherAtTick", () => {
  const region = REGIONS[0];

  it("is deterministic for the same seed and tick", () => {
    for (let tick = 0; tick < 30; tick++) {
      expect(weatherAtTick(region.id, tick, 12345)).toBe(weatherAtTick(region.id, tick, 12345));
    }
  });

  it("differs across seeds somewhere in a window", () => {
    const a = Array.from({ length: 50 }, (_, t) => weatherAtTick(region.id, t, 1));
    const b = Array.from({ length: 50 }, (_, t) => weatherAtTick(region.id, t, 2));
    expect(a.join()).not.toBe(b.join());
  });

  it("rejects unknown region ids", () => {
    expect(() => weatherAtTick("region.nowhere", 0, 1)).toThrow();
  });

  it("always returns one of the four defined weather kinds", () => {
    for (let t = 0; t < 200; t++) {
      expect(WEATHER_KINDS).toContain(weatherAtTick(region.id, t, 999));
    }
  });

  it("gives higher-danger regions a higher STORM_BREWING rate over a large sample", () => {
    const N = 3000;
    const low = REGIONS.reduce((a, b) => (a.danger <= b.danger ? a : b));
    const high = REGIONS.reduce((a, b) => (a.danger >= b.danger ? a : b));
    const rate = (r: (typeof REGIONS)[number]) => {
      let storms = 0;
      for (let t = 0; t < N; t++) {
        if (weatherAtTick(r.id, t, 42) === "STORM_BREWING") storms++;
      }
      return storms / N;
    };
    expect(rate(high)).toBeGreaterThan(rate(low));

    // 對照公式本身（docs/10 §M14 範例：danger 0.1→4%、0.5→12%）
    const expectedLow = BALANCE.WEATHER_STORM_BASE + low.danger * BALANCE.WEATHER_STORM_DANGER_FACTOR;
    const expectedHigh = BALANCE.WEATHER_STORM_BASE + high.danger * BALANCE.WEATHER_STORM_DANGER_FACTOR;
    expect(rate(low)).toBeGreaterThan(expectedLow - 0.03);
    expect(rate(low)).toBeLessThan(expectedLow + 0.03);
    expect(rate(high)).toBeGreaterThan(expectedHigh - 0.03);
    expect(rate(high)).toBeLessThan(expectedHigh + 0.03);
  });
});

describe("weather modifier helpers", () => {
  it("BREEZE speeds up sailing, everything else is neutral", () => {
    expect(weatherSpeedMult("BREEZE")).toBe(BALANCE.WEATHER_BREEZE_SPEED_MULT);
    expect(weatherSpeedMult("CLEAR")).toBe(1);
    expect(weatherSpeedMult("FOG")).toBe(1);
    expect(weatherSpeedMult("STORM_BREWING")).toBe(1);
  });

  it("FOG raises encounter rate and lowers exploration success, everything else neutral", () => {
    expect(weatherEncounterMult("FOG")).toBeCloseTo(1 + BALANCE.WEATHER_FOG_MODIFIER);
    expect(weatherEncounterMult("CLEAR")).toBe(1);
    expect(weatherExplorationMult("FOG")).toBeCloseTo(1 - BALANCE.WEATHER_FOG_MODIFIER);
    expect(weatherExplorationMult("CLEAR")).toBe(1);
  });

  it("STORM_BREWING multiplies storm-event chance, everything else neutral", () => {
    expect(weatherStormEventMult("STORM_BREWING")).toBe(BALANCE.WEATHER_STORM_EVENT_MULT);
    expect(weatherStormEventMult("CLEAR")).toBe(1);
    expect(weatherStormEventMult("FOG")).toBe(1);
    expect(weatherStormEventMult("BREEZE")).toBe(1);
  });
});
