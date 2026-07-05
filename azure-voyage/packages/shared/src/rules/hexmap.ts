import type { OffsetCoord } from "./hex";

/** 地形代碼（hexmap.json 每格一字元） */
export const TERRAIN = {
  DEEP: "D",
  SHALLOW: "S",
  REEF: "R",
  LAND: "L",
  PORT: "P",
} as const;

export type Terrain = (typeof TERRAIN)[keyof typeof TERRAIN];

export interface HexMap {
  width: number;
  height: number;
  /** height 列，每列為 width 個地形字元 */
  rows: string[];
}

export function inBounds(map: HexMap, { col, row }: OffsetCoord): boolean {
  return col >= 0 && col < map.width && row >= 0 && row < map.height;
}

export function terrainAt(map: HexMap, coord: OffsetCoord): Terrain {
  if (!inBounds(map, coord)) return TERRAIN.LAND; // 界外視為不可通行
  return map.rows[coord.row][coord.col] as Terrain;
}

export function isNavigable(terrain: Terrain): boolean {
  return terrain !== TERRAIN.LAND;
}

/** 航行成本（A* 與移動共用；暗礁可過但昂貴且之後會有觸礁風險） */
export function moveCost(terrain: Terrain): number {
  switch (terrain) {
    case TERRAIN.DEEP:
    case TERRAIN.PORT:
      return 1;
    case TERRAIN.SHALLOW:
      return 1.2;
    case TERRAIN.REEF:
      return 3;
    case TERRAIN.LAND:
      return Infinity;
  }
}

export function assertValidMap(map: HexMap): void {
  if (map.rows.length !== map.height) {
    throw new Error(`hexmap: expected ${map.height} rows, got ${map.rows.length}`);
  }
  for (const [i, row] of map.rows.entries()) {
    if (row.length !== map.width) {
      throw new Error(`hexmap: row ${i} length ${row.length} != width ${map.width}`);
    }
  }
}
