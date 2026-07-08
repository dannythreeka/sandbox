/**
 * 風向系統（docs/10 §M11）。
 * 所有函式皆為確定性純函式：同 world seed + tick 必得同結果，
 * 前後端可各自計算、斷線重連一致、可單測。
 */
import { BALANCE } from "../content/constants";
import { REGIONS, SEASONS, type Season, type WindDirection } from "../content/regions";
import { axialToOddr, oddrToAxial, type OffsetCoord } from "./hex";
import { inBounds, isNavigable, terrainAt, type HexMap } from "./hexmap";
import { deriveSeed, Rng } from "./rng";

/** tick → 季節（一年 = 4 × SEASON_TICKS 天） */
export function seasonAtTick(tick: number): Season {
  return SEASONS[Math.floor(tick / BALANCE.SEASON_TICKS) % SEASONS.length];
}

/** regionId → 穩定整數（windAtTick/weatherAtTick 的 rng stream 用；FNV-1a 簡化版） */
export function hashRegionId(regionId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < regionId.length; i++) {
    h ^= regionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h & 0x7fffffff;
}

/**
 * 某海域在某 tick 的當日風向：當季主風向 + 確定性每日擾動
 * （主 60%／左右鄰向各 15%／其餘三向均分 10%，見 BALANCE.WIND_JITTER_*）。
 */
export function windAtTick(regionId: string, tick: number, worldSeed: number): WindDirection {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) throw new Error(`unknown region: ${regionId}`);
  const main = region.winds[seasonAtTick(tick)];
  const rng = new Rng(deriveSeed(worldSeed, 0x81d0, hashRegionId(regionId), tick));
  const roll = rng.float();
  const pMain = BALANCE.WIND_JITTER_MAIN;
  const pAdj = BALANCE.WIND_JITTER_ADJACENT;
  if (roll < pMain) return main;
  if (roll < pMain + pAdj) return ((main + 1) % 6) as WindDirection;
  if (roll < pMain + pAdj * 2) return ((main + 5) % 6) as WindDirection;
  const others = [2, 3, 4].map((k) => ((main + k) % 6) as WindDirection);
  return others[rng.int(0, others.length - 1)];
}

/**
 * 相鄰兩格的 hex 方位（axial 差向量），與 WindDirection 同一約定：
 * 0=東，逆時針（1=東北、2=西北、3=西、4=西南、5=東南；row 向下為南）。
 * 非相鄰格回傳 null。
 */
export function hexDirectionBetween(from: OffsetCoord, to: OffsetCoord): WindDirection | null {
  const a = oddrToAxial(from);
  const b = oddrToAxial(to);
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  if (dq === 1 && dr === 0) return 0;
  if (dq === 1 && dr === -1) return 1;
  if (dq === 0 && dr === -1) return 2;
  if (dq === -1 && dr === 0) return 3;
  if (dq === -1 && dr === 1) return 4;
  if (dq === 0 && dr === 1) return 5;
  return null;
}

/** 航向與風向的夾角檔位 0–3（0=同向順風、3=正對逆風） */
export function windAngleGap(heading: WindDirection, wind: WindDirection): 0 | 1 | 2 | 3 {
  const d = Math.abs(heading - wind) % 6;
  return Math.min(d, 6 - d) as 0 | 1 | 2 | 3;
}

/** 航向對上當日風向的速度修正（BALANCE.WIND_MODIFIERS 查表） */
export function windModifierFor(heading: WindDirection, wind: WindDirection): number {
  return BALANCE.WIND_MODIFIERS[windAngleGap(heading, wind)];
}

const DIR_TO_AXIAL_DELTA: Record<WindDirection, readonly [number, number]> = {
  0: [1, 0],
  1: [1, -1],
  2: [0, -1],
  3: [-1, 0],
  4: [-1, 1],
  5: [0, 1],
};

/**
 * 指定方位上的相鄰格（hexDirectionBetween 的反函式，M12 鍵盤操舵用：
 * 給定當前格與航向，算出下一格）。
 */
export function hexNeighborInDirection(coord: OffsetCoord, dir: WindDirection): OffsetCoord {
  const axial = oddrToAxial(coord);
  const [dq, dr] = DIR_TO_AXIAL_DELTA[dir];
  return axialToOddr({ q: axial.q + dq, r: axial.r + dr });
}

/**
 * 供「首次出港但玩家從未操舵過」挑一個預設航向（M12）：由東（0）起逆時針
 * 找第一個可航行方位；六向皆陸地（理論上不會發生——港口必臨海）回傳 null。
 */
export function firstNavigableHeading(map: HexMap, coord: OffsetCoord): WindDirection | null {
  for (let dir = 0; dir < 6; dir++) {
    const next = hexNeighborInDirection(coord, dir as WindDirection);
    if (inBounds(map, next) && isNavigable(terrainAt(map, next))) return dir as WindDirection;
  }
  return null;
}
