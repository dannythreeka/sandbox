import { describe, expect, it } from "vitest";
import { buildingCountForSize, generatePortSilhouette } from "./portSilhouette";

describe("generatePortSilhouette", () => {
  it("is deterministic for the same portId and size", () => {
    const a = generatePortSilhouette("port.amber_gulf.aurelia", 2);
    const b = generatePortSilhouette("port.amber_gulf.aurelia", 2);
    expect(a).toEqual(b);
  });

  it("differs across port ids", () => {
    const a = generatePortSilhouette("port.a", 2);
    const b = generatePortSilhouette("port.b", 2);
    expect(a).not.toEqual(b);
  });

  it("differs across sizes for the same port id", () => {
    const a = generatePortSilhouette("port.x", 1);
    const b = generatePortSilhouette("port.x", 3);
    expect(a).not.toEqual(b);
  });

  it("building count increases with port size", () => {
    expect(buildingCountForSize(1)).toBeLessThan(buildingCountForSize(2));
    expect(buildingCountForSize(2)).toBeLessThan(buildingCountForSize(3));
    for (const size of [1, 2, 3] as const) {
      expect(generatePortSilhouette("port.x", size).buildings.length).toBe(buildingCountForSize(size));
    }
  });

  it("lays out buildings left-to-right without overlap, within sane bounds", () => {
    const s = generatePortSilhouette("port.y", 3);
    let prevEnd = -Infinity;
    for (const b of s.buildings) {
      expect(b.x).toBeGreaterThanOrEqual(prevEnd);
      expect(b.width).toBeGreaterThan(0);
      expect(b.height).toBeGreaterThan(0);
      expect(b.roofPeak).toBeGreaterThanOrEqual(0);
      prevEnd = b.x + b.width;
    }
    expect(s.totalWidth).toBeGreaterThanOrEqual(prevEnd);
    expect(s.totalWidth).toBeGreaterThanOrEqual(s.dockWidth);
  });
});
