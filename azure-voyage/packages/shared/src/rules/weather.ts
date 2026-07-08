/**
 * 每日天氣（docs/10 §M14）。與風向系統（wind.ts）同一套確定性管線：
 * 同 world seed + tick 必得同結果，前後端可各自計算、斷線重連一致、可單測。
 * 刻意做成輕量的視覺/機率修正層，不是獨立的模擬系統。
 */
import { BALANCE } from "../content/constants";
import { REGIONS } from "../content/regions";
import { hashRegionId } from "./wind";
import { deriveSeed, Rng } from "./rng";

export const WEATHER_KINDS = ["CLEAR", "BREEZE", "FOG", "STORM_BREWING"] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

/**
 * 某海域在某 tick 的當日天氣：風暴醞釀機率按海域 danger 加權，
 * 起霧／微風機率固定（見 BALANCE.WEATHER_*）。獨立於 windAtTick 的 rng stream
 * （不同 magic number），避免兩者的擲骰彼此相關。
 */
export function weatherAtTick(regionId: string, tick: number, worldSeed: number): WeatherKind {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) throw new Error(`unknown region: ${regionId}`);

  const rng = new Rng(deriveSeed(worldSeed, 0x7ea7, hashRegionId(regionId), tick));
  const roll = rng.float();
  const stormProb = BALANCE.WEATHER_STORM_BASE + region.danger * BALANCE.WEATHER_STORM_DANGER_FACTOR;
  const fogProb = BALANCE.WEATHER_FOG_PROB;
  const breezeProb = BALANCE.WEATHER_BREEZE_PROB;

  if (roll < stormProb) return "STORM_BREWING";
  if (roll < stormProb + fogProb) return "FOG";
  if (roll < stormProb + fogProb + breezeProb) return "BREEZE";
  return "CLEAR";
}

/** 天氣對航速的修正（BREEZE 加成，其餘無效果）。 */
export function weatherSpeedMult(weather: WeatherKind): number {
  return weather === "BREEZE" ? BALANCE.WEATHER_BREEZE_SPEED_MULT : 1;
}

/** 天氣對海賊遭遇率的修正（FOG 提高遭遇率）。 */
export function weatherEncounterMult(weather: WeatherKind): number {
  return weather === "FOG" ? 1 + BALANCE.WEATHER_FOG_MODIFIER : 1;
}

/** 天氣對探索成功率的修正（FOG 降低成功率）。 */
export function weatherExplorationMult(weather: WeatherKind): number {
  return weather === "FOG" ? 1 - BALANCE.WEATHER_FOG_MODIFIER : 1;
}

/** 天氣對風暴事件機率的修正（STORM_BREWING 加乘，風暴仍是獨立擲骰的事件）。 */
export function weatherStormEventMult(weather: WeatherKind): number {
  return weather === "STORM_BREWING" ? BALANCE.WEATHER_STORM_EVENT_MULT : 1;
}
