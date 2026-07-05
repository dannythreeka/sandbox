import { describe, expect, it } from "vitest";
import {
  axialToOddr,
  hexDistance,
  hexNeighbors,
  oddrToAxial,
  offsetDistance,
} from "./hex";

describe("hex geometry", () => {
  it("offset ↔ axial roundtrip", () => {
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        expect(axialToOddr(oddrToAxial({ col, row }))).toEqual({ col, row });
      }
    }
  });

  it("distance is symmetric and zero on self", () => {
    const a = oddrToAxial({ col: 3, row: 4 });
    const b = oddrToAxial({ col: 9, row: 1 });
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    expect(hexDistance(a, a)).toBe(0);
  });

  it("all six neighbors are at distance 1", () => {
    for (const center of [{ col: 5, row: 4 }, { col: 5, row: 5 }]) {
      const neighbors = hexNeighbors(center);
      expect(neighbors).toHaveLength(6);
      expect(new Set(neighbors.map((n) => `${n.col},${n.row}`)).size).toBe(6);
      for (const n of neighbors) {
        expect(offsetDistance(center, n)).toBe(1);
      }
    }
  });

  it("triangle inequality holds on samples", () => {
    const a = { col: 0, row: 0 };
    const b = { col: 7, row: 3 };
    const c = { col: 2, row: 9 };
    expect(offsetDistance(a, c)).toBeLessThanOrEqual(
      offsetDistance(a, b) + offsetDistance(b, c),
    );
  });
});
