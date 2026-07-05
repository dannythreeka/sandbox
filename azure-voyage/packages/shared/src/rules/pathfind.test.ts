import { describe, expect, it } from "vitest";
import { HEXMAP } from "../content/map/hexmap";
import { PORTS } from "../content/ports";
import { offsetDistance } from "./hex";
import { terrainAt, TERRAIN, type HexMap } from "./hexmap";
import { findPath } from "./pathfind";

function makeMap(rows: string[]): HexMap {
  return { width: rows[0].length, height: rows.length, rows };
}

describe("findPath (synthetic maps)", () => {
  it("finds a straight path on open water with expected length", () => {
    const map = makeMap(["DDDDD", "DDDDD", "DDDDD"]);
    const path = findPath(map, { col: 0, row: 1 }, { col: 4, row: 1 });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ col: 0, row: 1 });
    expect(path![path!.length - 1]).toEqual({ col: 4, row: 1 });
    expect(path!.length).toBe(5); // 距離 4 → 5 格含端點
  });

  it("returns null when land blocks completely", () => {
    const map = makeMap(["DDLDD", "DDLDD", "DDLDD"]);
    expect(findPath(map, { col: 0, row: 1 }, { col: 4, row: 1 })).toBeNull();
  });

  it("routes around land", () => {
    const map = makeMap(["DDDDD", "DLLLD", "DDDDD"]);
    const path = findPath(map, { col: 2, row: 0 }, { col: 2, row: 2 });
    expect(path).not.toBeNull();
    for (const step of path!) {
      expect(terrainAt(map, step)).not.toBe(TERRAIN.LAND);
    }
  });

  it("prefers deep water over reefs when cheaper", () => {
    // 上排礁石、下排深海：繞下排雖遠一點但成本較低
    const map = makeMap(["DRRRD", "DDDDD"]);
    const path = findPath(map, { col: 0, row: 0 }, { col: 4, row: 0 });
    expect(path).not.toBeNull();
    const reefSteps = path!.filter((c) => terrainAt(map, c) === TERRAIN.REEF).length;
    expect(reefSteps).toBe(0);
  });
});

describe("findPath (real hexmap)", () => {
  it("every port is reachable from the home capital", () => {
    const home = PORTS.find((p) => p.id === "port.amber_gulf.aurelia")!;
    for (const port of PORTS) {
      const path = findPath(HEXMAP, home.coord, port.coord);
      expect(path, `no route ${home.id} → ${port.id}`).not.toBeNull();
    }
  });

  it("port cells are marked P and paths are not absurdly long", () => {
    const home = PORTS.find((p) => p.id === "port.amber_gulf.aurelia")!;
    for (const port of PORTS) {
      expect(terrainAt(HEXMAP, port.coord)).toBe(TERRAIN.PORT);
      const path = findPath(HEXMAP, home.coord, port.coord)!;
      // 路徑長不應超過直線距離的 4 倍（地圖健康度檢查）
      const straight = Math.max(1, offsetDistance(home.coord, port.coord));
      expect(path.length).toBeLessThanOrEqual(straight * 4 + 6);
    }
  });
});
