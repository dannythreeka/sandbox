/** 七大海域（docs/01 §1）。危險度影響遭遇率（M2）；季節風向供航行計算（M2）。 */

export const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as const;
export type Season = (typeof SEASONS)[number];

/** 風向：六角格的六個方位（0=東，逆時針） */
export type WindDirection = 0 | 1 | 2 | 3 | 4 | 5;

export interface RegionDef {
  id: string;
  name: string;
  /** 0.0–1.0：航行事件基礎機率係數 */
  danger: number;
  /** 各季主風向 */
  winds: Record<Season, WindDirection>;
  /** 海域大致範圍（offset 座標，供地圖歸屬與 UI 標示） */
  bounds: { colMin: number; colMax: number; rowMin: number; rowMax: number };
}

export const REGIONS: readonly RegionDef[] = [
  {
    id: "region.north_reach",
    name: "北環海",
    danger: 0.35,
    winds: { SPRING: 1, SUMMER: 0, AUTUMN: 4, WINTER: 3 },
    bounds: { colMin: 0, colMax: 55, rowMin: 0, rowMax: 21 },
  },
  {
    id: "region.amber_gulf",
    name: "琥珀灣",
    danger: 0.1,
    winds: { SPRING: 0, SUMMER: 5, AUTUMN: 1, WINTER: 2 },
    bounds: { colMin: 30, colMax: 65, rowMin: 22, rowMax: 42 },
  },
  {
    id: "region.ironcliff",
    name: "鐵崖海岸",
    danger: 0.25,
    winds: { SPRING: 2, SUMMER: 1, AUTUMN: 3, WINTER: 3 },
    bounds: { colMin: 0, colMax: 29, rowMin: 22, rowMax: 58 },
  },
  {
    id: "region.silkwind",
    name: "絹風海峽",
    danger: 0.2,
    winds: { SPRING: 5, SUMMER: 5, AUTUMN: 0, WINTER: 1 },
    bounds: { colMin: 72, colMax: 119, rowMin: 14, rowMax: 42 },
  },
  {
    id: "region.meridian",
    name: "子午之海",
    danger: 0.45,
    winds: { SPRING: 3, SUMMER: 2, AUTUMN: 5, WINTER: 4 },
    bounds: { colMin: 38, colMax: 78, rowMin: 43, rowMax: 62 },
  },
  {
    id: "region.coral_arc",
    name: "珊瑚環弧",
    danger: 0.3,
    winds: { SPRING: 4, SUMMER: 3, AUTUMN: 2, WINTER: 5 },
    bounds: { colMin: 79, colMax: 119, rowMin: 43, rowMax: 79 },
  },
  {
    id: "region.dusk_expanse",
    name: "暮色洋",
    danger: 0.6,
    winds: { SPRING: 2, SUMMER: 4, AUTUMN: 1, WINTER: 0 },
    bounds: { colMin: 0, colMax: 78, rowMin: 59, rowMax: 79 },
  },
] as const;

export const REGION_IDS = REGIONS.map((r) => r.id);

export function regionById(id: string): RegionDef {
  const region = REGIONS.find((r) => r.id === id);
  if (!region) throw new Error(`unknown region: ${id}`);
  return region;
}

/** 依 offset 座標找出所屬海域（docs/05 §3 遭遇判定用）；落在邊界外時回傳最近海域。 */
export function regionForCoord(coord: { col: number; row: number }): RegionDef {
  const hit = REGIONS.find(
    (r) =>
      coord.col >= r.bounds.colMin &&
      coord.col <= r.bounds.colMax &&
      coord.row >= r.bounds.rowMin &&
      coord.row <= r.bounds.rowMax,
  );
  if (hit) return hit;

  let best = REGIONS[0];
  let bestDist = Infinity;
  for (const region of REGIONS) {
    const cx = (region.bounds.colMin + region.bounds.colMax) / 2;
    const cy = (region.bounds.rowMin + region.bounds.rowMax) / 2;
    const dist = (coord.col - cx) ** 2 + (coord.row - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = region;
    }
  }
  return best;
}
