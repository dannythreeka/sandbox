import { describe, expect, it } from "vitest";
import { PORTS } from "./ports";
import { regionForCoord } from "./regions";

describe("regionForCoord", () => {
  it("finds the correct region for every port's own coordinates", () => {
    for (const port of PORTS) {
      const region = regionForCoord(port.coord);
      expect(region.id, `${port.id} @ ${JSON.stringify(port.coord)}`).toBe(port.regionId);
    }
  });

  it("falls back to nearest region for out-of-bounds coordinates", () => {
    const region = regionForCoord({ col: -100, row: -100 });
    expect(region).toBeDefined();
  });
});
