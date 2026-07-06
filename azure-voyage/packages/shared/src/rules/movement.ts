/**
 * 艦隊航行推進（docs/05 §3）。
 * M2 簡化：先不計入風向修正（docs/01 §4.1 的 wind_modifier），
 * 待海況/風系統上線後在 fleetSpeed 補上 wind_modifier 與 condition_modifier。
 */
import { hexNeighbors, offsetDistance, type OffsetCoord } from "./hex";
import { moveCost, terrainAt, type HexMap } from "./hexmap";

export interface Route {
  waypoints: OffsetCoord[];
  cursor: number;
  targetPortId?: string;
}

/** 每 tick 基礎移動格數（船速 / 10，向下取整，至少 1）。 */
export function fleetSpeed(slowestShipSpeed: number): number {
  return Math.max(1, Math.floor(slowestShipSpeed / 10));
}

export interface StepResult {
  pos: OffsetCoord;
  cursor: number;
  arrived: boolean;
}

/**
 * 沿 route 前進最多 speedBudget 格（以 moveCost 累計消耗，暗礁較慢）。
 * cursor 指向「已抵達」的 waypoint 索引；抵達最後一個 waypoint 視為到站。
 */
export function stepAlongRoute(map: HexMap, route: Route, speedBudget: number): StepResult {
  let cursor = route.cursor;
  let budget = speedBudget;
  let pos = route.waypoints[cursor];

  while (budget > 0 && cursor < route.waypoints.length - 1) {
    const next = route.waypoints[cursor + 1];
    const cost = moveCost(terrainAt(map, next));
    if (cost > budget) break;
    budget -= cost;
    cursor += 1;
    pos = next;
  }

  return { pos, cursor, arrived: cursor === route.waypoints.length - 1 };
}

/** 驗證 waypoints 為相鄰格組成的合法航線（後端信任邊界：拒絕瞬移/跳格）。 */
export function isContiguousRoute(waypoints: OffsetCoord[]): boolean {
  for (let i = 1; i < waypoints.length; i++) {
    if (offsetDistance(waypoints[i - 1], waypoints[i]) !== 1) return false;
  }
  return true;
}

export function neighborsOf(coord: OffsetCoord): OffsetCoord[] {
  return hexNeighbors(coord);
}
