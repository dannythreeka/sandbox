import { describe, expect, it } from "vitest";
import { HEXMAP } from "./map/hexmap";
import { DISCOVERIES } from "./discoveries";
import { PORTS } from "./ports";
import { terrainAt, TERRAIN } from "../rules/hexmap";

describe("discoveries content", () => {
  it("has unique ids", () => {
    expect(new Set(DISCOVERIES.map((d) => d.id)).size).toBe(DISCOVERIES.length);
  });

  it("sits on navigable, non-land water", () => {
    for (const d of DISCOVERIES) {
      expect(terrainAt(HEXMAP, d.coord), d.id).not.toBe(TERRAIN.LAND);
    }
  });

  it("does not coincide with a port hex", () => {
    for (const d of DISCOVERIES) {
      const clash = PORTS.find((p) => p.coord.col === d.coord.col && p.coord.row === d.coord.row);
      expect(clash, `${d.id} clashes with ${clash?.id}`).toBeUndefined();
    }
  });
});
