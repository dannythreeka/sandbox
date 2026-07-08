import { describe, expect, it } from "vitest";
import { BALANCE } from "../content/constants";
import { REGIONS, type WindDirection } from "../content/regions";
import { hexNeighbors, type OffsetCoord } from "./hex";
import {
  hexDirectionBetween,
  regionAt,
  seasonAtTick,
  windAngleGap,
  windAtTick,
  windModifierFor,
} from "./wind";

describe("seasonAtTick", () => {
  it("maps tick boundaries to the right season", () => {
    const S = BALANCE.SEASON_TICKS;
    expect(seasonAtTick(0)).toBe("SPRING");
    expect(seasonAtTick(S - 1)).toBe("SPRING");
    expect(seasonAtTick(S)).toBe("SUMMER");
    expect(seasonAtTick(2 * S)).toBe("AUTUMN");
    expect(seasonAtTick(3 * S)).toBe("WINTER");
    expect(seasonAtTick(4 * S)).toBe("SPRING"); // 跨年回春
    expect(seasonAtTick(4 * S - 1)).toBe("WINTER");
  });
});

describe("regionAt", () => {
  it("resolves a coord inside a region's bounds to that region", () => {
    for (const region of REGIONS) {
      const b = region.bounds;
      const inside = {
        col: Math.floor((b.colMin + b.colMax) / 2),
        row: Math.floor((b.rowMin + b.rowMax) / 2),
      };
      // 中心點可能落在定義順序更早、範圍重疊的海域；至少必須命中「某個」包含它的海域
      const got = regionAt(inside);
      const gb = got.bounds;
      expect(
        inside.col >= gb.colMin && inside.col <= gb.colMax &&
        inside.row >= gb.rowMin && inside.row <= gb.rowMax,
      ).toBe(true);
    }
  });

  it("falls back to the nearest region for out-of-bounds coords", () => {
    expect(() => regionAt({ col: -50, row: -50 })).not.toThrow();
    expect(regionAt({ col: -50, row: -50 })).toBeDefined();
  });
});

describe("windAtTick", () => {
  const region = REGIONS[0];

  it("is deterministic for the same seed and tick", () => {
    for (let tick = 0; tick < 30; tick++) {
      expect(windAtTick(region.id, tick, 12345)).toBe(windAtTick(region.id, tick, 12345));
    }
  });

  it("differs across seeds somewhere in a window", () => {
    const a = Array.from({ length: 50 }, (_, t) => windAtTick(region.id, t, 1));
    const b = Array.from({ length: 50 }, (_, t) => windAtTick(region.id, t, 2));
    expect(a.join()).not.toBe(b.join());
  });

  it("roughly follows the jitter distribution over a large sample", () => {
    const N = 4000;
    let main = 0;
    let adjacent = 0;
    for (let t = 0; t < N; t++) {
      const w = windAtTick(region.id, t, 777);
      const m = region.winds[seasonAtTick(t)];
      const gap = windAngleGap(w, m);
      if (gap === 0) main++;
      else if (gap === 1) adjacent++;
    }
    // 主 60%、鄰向共 30%，抓寬鬆容差（±6%）避免測試脆弱
    expect(main / N).toBeGreaterThan(0.54);
    expect(main / N).toBeLessThan(0.66);
    expect(adjacent / N).toBeGreaterThan(0.24);
    expect(adjacent / N).toBeLessThan(0.36);
  });

  it("rejects unknown region ids", () => {
    expect(() => windAtTick("region.nowhere", 0, 1)).toThrow();
  });
});

describe("hexDirectionBetween", () => {
  it("assigns each of the six neighbors a distinct direction, east/west exact", () => {
    for (const origin of [{ col: 10, row: 10 }, { col: 10, row: 11 }] as OffsetCoord[]) {
      const dirs = hexNeighbors(origin).map((n) => hexDirectionBetween(origin, n));
      expect(new Set(dirs).size).toBe(6);
      expect(hexDirectionBetween(origin, { col: origin.col + 1, row: origin.row })).toBe(0);
      expect(hexDirectionBetween(origin, { col: origin.col - 1, row: origin.row })).toBe(3);
      // row-1（北側）鄰居必為 1 或 2；row+1（南側）必為 4 或 5
      for (const n of hexNeighbors(origin)) {
        const d = hexDirectionBetween(origin, n)!;
        if (n.row < origin.row) expect([1, 2]).toContain(d);
        if (n.row > origin.row) expect([4, 5]).toContain(d);
      }
    }
  });

  it("returns null for non-adjacent hexes", () => {
    expect(hexDirectionBetween({ col: 0, row: 0 }, { col: 5, row: 0 })).toBeNull();
    expect(hexDirectionBetween({ col: 0, row: 0 }, { col: 0, row: 0 })).toBeNull();
  });
});

describe("windAngleGap / windModifierFor", () => {
  it("covers all 36 heading×wind combos with the right gap", () => {
    for (let h = 0; h < 6; h++) {
      for (let w = 0; w < 6; w++) {
        const d = Math.abs(h - w) % 6;
        const expected = Math.min(d, 6 - d);
        expect(windAngleGap(h as WindDirection, w as WindDirection)).toBe(expected);
        expect(windModifierFor(h as WindDirection, w as WindDirection)).toBe(
          BALANCE.WIND_MODIFIERS[expected],
        );
      }
    }
  });

  it("tailwind beats headwind", () => {
    expect(windModifierFor(0, 0)).toBeGreaterThan(windModifierFor(0, 3));
  });
});
