import { describe, expect, it } from "vitest";
import type { HexMap } from "./hexmap";
import { fleetSpeed, isContiguousRoute, stepAlongRoute, type Route } from "./movement";

function makeMap(rows: string[]): HexMap {
  return { width: rows[0].length, height: rows.length, rows };
}

describe("fleetSpeed", () => {
  it("scales with ship speed, minimum 1", () => {
    expect(fleetSpeed(36)).toBe(3);
    expect(fleetSpeed(5)).toBe(1);
    expect(fleetSpeed(0)).toBe(1);
  });
});

describe("isContiguousRoute", () => {
  it("accepts adjacent-only paths", () => {
    expect(isContiguousRoute([{ col: 0, row: 0 }, { col: 1, row: 0 }])).toBe(true);
  });
  it("rejects teleporting waypoints", () => {
    expect(isContiguousRoute([{ col: 0, row: 0 }, { col: 5, row: 5 }])).toBe(false);
  });
});

describe("stepAlongRoute", () => {
  const map = makeMap(["DDDDD"]);
  const route: Route = {
    waypoints: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
      { col: 4, row: 0 },
    ],
    cursor: 0,
  };

  it("advances by budget on open water", () => {
    const result = stepAlongRoute(map, route, 2);
    expect(result.cursor).toBe(2);
    expect(result.pos).toEqual({ col: 2, row: 0 });
    expect(result.arrived).toBe(false);
  });

  it("stops exactly at the last waypoint and reports arrival", () => {
    const result = stepAlongRoute(map, route, 10);
    expect(result.cursor).toBe(4);
    expect(result.arrived).toBe(true);
  });

  it("does not overshoot into higher-cost terrain beyond budget", () => {
    const reefMap = makeMap(["DDRDD"]);
    const r = stepAlongRoute(reefMap, route, 2); // 到 col1 花1，col2(礁)要3 > 剩餘1，停在col1
    expect(r.cursor).toBe(1);
  });
});
