import { describe, expect, it } from "vitest";
import { PORTS } from "../content/ports";
import { regionsDominatedBy, type PortShareRow } from "./dominance";

const amberPorts = PORTS.filter((p) => p.regionId === "region.amber_gulf").map((p) => p.id);
const northPorts = PORTS.filter((p) => p.regionId === "region.north_reach").map((p) => p.id);

describe("regionsDominatedBy", () => {
  it("counts a region when the guild's average share meets the threshold and is highest", () => {
    const rows: PortShareRow[] = amberPorts.map((portId) => ({ portId, guildId: "player", share: 50 }));
    expect(regionsDominatedBy("player", rows)).toBe(1);
  });

  it("does not count a region below the dominance threshold", () => {
    const rows: PortShareRow[] = amberPorts.map((portId) => ({ portId, guildId: "player", share: 30 }));
    expect(regionsDominatedBy("player", rows)).toBe(0);
  });

  it("does not count a region where a rival has more share", () => {
    const rows: PortShareRow[] = amberPorts.flatMap((portId) => [
      { portId, guildId: "player", share: 41 },
      { portId, guildId: "rival", share: 45 },
    ]);
    expect(regionsDominatedBy("player", rows)).toBe(0);
  });

  it("sums across multiple dominated regions", () => {
    const rows: PortShareRow[] = [
      ...amberPorts.map((portId) => ({ portId, guildId: "player", share: 60 })),
      ...northPorts.map((portId) => ({ portId, guildId: "player", share: 55 })),
    ];
    expect(regionsDominatedBy("player", rows)).toBe(2);
  });

  it("returns 0 for a guild with no rows", () => {
    expect(regionsDominatedBy("nobody", [])).toBe(0);
  });
});
