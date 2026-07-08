import { describe, expect, it } from "vitest";
import type { HexMap } from "./hexmap";
import {
  fleetSpeed,
  isContiguousRoute,
  navigatorSpeedBonus,
  stepAlongRoute,
  stepManualHeading,
  type Route,
} from "./movement";

function makeMap(rows: string[]): HexMap {
  return { width: rows[0].length, height: rows.length, rows };
}

describe("fleetSpeed", () => {
  it("scales with ship speed, minimum 1", () => {
    expect(fleetSpeed(36)).toBe(3);
    expect(fleetSpeed(5)).toBe(1);
    expect(fleetSpeed(0)).toBe(1);
  });

  it("applies a navigator bonus percentage", () => {
    expect(fleetSpeed(36, 0.2)).toBe(Math.floor((36 * 1.2) / 10));
    expect(fleetSpeed(36, 0.2)).toBeGreaterThan(fleetSpeed(36, 0));
  });
});

describe("navigatorSpeedBonus", () => {
  it("scales with nav stat, capped at 20%", () => {
    expect(navigatorSpeedBonus(undefined)).toBe(0);
    expect(navigatorSpeedBonus(0)).toBe(0);
    expect(navigatorSpeedBonus(50)).toBeCloseTo(0.1);
    expect(navigatorSpeedBonus(100)).toBe(0.2);
    expect(navigatorSpeedBonus(100000)).toBe(0.2);
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

describe("stepManualHeading", () => {
  const map = makeMap(["DDDDD"]);

  it("advances straight along a fixed heading (east) by budget", () => {
    const r = stepManualHeading(map, { col: 0, row: 0 }, 0, 2);
    expect(r.pos).toEqual({ col: 2, row: 0 });
    expect(r.spent).toBe(2);
    expect(r.blockedByLand).toBe(false);
  });

  it("stops short of overshooting into a costlier reef tile", () => {
    const reefMap = makeMap(["DDRDD"]);
    const r = stepManualHeading(reefMap, { col: 0, row: 0 }, 0, 2); // col1 花1，col2(礁)要3>剩1
    expect(r.pos).toEqual({ col: 1, row: 0 });
    expect(r.spent).toBe(1);
    expect(r.blockedByLand).toBe(false);
  });

  it("reports blockedByLand instead of moving onto land", () => {
    const landMap = makeMap(["DDLDD"]);
    const r = stepManualHeading(landMap, { col: 0, row: 0 }, 0, 5);
    expect(r.pos).toEqual({ col: 1, row: 0 }); // 卡在陸地前一格
    expect(r.blockedByLand).toBe(true);
  });

  it("reports blockedByLand at the map edge (out of bounds)", () => {
    const r = stepManualHeading(map, { col: 4, row: 0 }, 0, 3);
    expect(r.pos).toEqual({ col: 4, row: 0 });
    expect(r.blockedByLand).toBe(true);
    expect(r.spent).toBe(0);
  });
});
