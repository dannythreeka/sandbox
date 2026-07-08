/**
 * 風向系統（docs/10 §M11）。
 * 所有函式皆為確定性純函式：同 world seed + tick 必得同結果，
 * 前後端可各自計算、斷線重連一致、可單測。
 */
import { BALANCE } from "../content/constants";
import { REGIONS, SEASONS, type RegionDef, type Season, type WindDirection } from "../content/regions";
import { oddrToAxial, type OffsetCoord } from "./hex";
import { deriveSeed, Rng } from "./rng";

/** tick → 季節（一年 = 4 × SEASON_TICKS 天） */
export function seasonAtTick(tick: number): Season {
  return SEASONS[Math.floor(tick / BALANCE.SEASON_TICKS) % SEASONS.length];
}

/**
 * 座標 → 所屬海域。以 bounds 查找；多個命中取定義順序第一個；
 * 皆未命中（地圖邊角縫隙防呆）取 bounds 中心距離最近者。
 */
export function regionAt(coord: OffsetCoord): RegionDef {
  for (const region of REGIONS) {
    const b = region.bounds;
    if (coord.col >= b.colMin && coord.col <= b.colMax && coord.row >= b.rowMin && coord.row <= b.rowMax) {
      return region;
    }
  }
  let best = REGIONS[0];
  let bestD = Infinity;
  for (const region of REGIONS) {
    const b = region.bounds;
    const cx = (b.colMin + b.colMax) / 2;
    const cy = (b.rowMin + b.rowMax) / 2;
    const d = (coord.col - cx) ** 2 + (coord.row - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = region;
    }
  }
  return best;
}

/** regionId → 穩定整數（windAtTick 的 rng stream 用；FNV-1a 簡化版） */
function hashRegionId(regionId: string): number {
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
