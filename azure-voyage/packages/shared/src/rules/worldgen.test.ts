import { describe, expect, it } from "vitest";
import { COMMODITY_IDS, commodityById } from "../content/commodities";
import { NPC_GUILD_TEMPLATES } from "../content/npcGuilds";
import { OFFICER_TEMPLATES } from "../content/officersPool";
import { PORTS } from "../content/ports";
import { REGION_IDS } from "../content/regions";
import { SHIP_CLASSES } from "../content/shipClasses";
import { startingGold } from "../content/constants";
import { buildNewWorldPlan } from "./worldgen";

describe("content pack integrity", () => {
  it("has exactly 7 regions, 15 ports, 36 commodities, 10 ship classes", () => {
    expect(REGION_IDS).toHaveLength(7);
    expect(PORTS).toHaveLength(15);
    expect(COMMODITY_IDS).toHaveLength(36);
    expect(SHIP_CLASSES).toHaveLength(10);
  });

  it("port ids are unique and reference valid regions/commodities", () => {
    expect(new Set(PORTS.map((p) => p.id)).size).toBe(PORTS.length);
    for (const port of PORTS) {
      expect(REGION_IDS).toContain(port.regionId);
      for (const c of port.produces) expect(() => commodityById(c)).not.toThrow();
    }
  });

  it("every commodity has at least one origin port", () => {
    const origins = new Set(PORTS.flatMap((p) => p.produces));
    for (const id of COMMODITY_IDS) {
      expect(origins.has(id), `${id} has no origin port`).toBe(true);
    }
  });
});

describe("buildNewWorldPlan", () => {
  it("is deterministic for the same seed", () => {
    expect(buildNewWorldPlan(777, "NORMAL")).toEqual(buildNewWorldPlan(777, "NORMAL"));
  });

  it("differs across seeds", () => {
    const a = buildNewWorldPlan(1, "NORMAL");
    const b = buildNewWorldPlan(2, "NORMAL");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("honors difficulty starting gold", () => {
    expect(buildNewWorldPlan(5, "EASY").playerGold).toBe(startingGold("EASY"));
    expect(buildNewWorldPlan(5, "HARD").playerGold).toBe(startingGold("HARD"));
  });

  it("covers all ports with valid markets", () => {
    const plan = buildNewWorldPlan(99, "NORMAL");
    expect(plan.ports).toHaveLength(PORTS.length);
    for (const port of plan.ports) {
      expect(port.market.length).toBeGreaterThanOrEqual(4);
      const ids = port.market.map((m) => m.commodityId);
      expect(new Set(ids).size).toBe(ids.length); // 不重複
      for (const entry of port.market) {
        expect(entry.price).toBeGreaterThan(0);
        expect(entry.stock).toBeGreaterThan(0);
        expect(entry.stock).toBe(entry.baseStock);
      }
    }
  });

  it("influence shares per port sum to exactly 100", () => {
    const plan = buildNewWorldPlan(42, "NORMAL");
    for (const port of plan.ports) {
      const sum = port.influences.reduce((acc, i) => acc + i.share, 0);
      expect(sum, port.portId).toBe(100);
      for (const entry of port.influences) {
        expect(entry.share).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("npc guilds only hold influence in their home region", () => {
    const plan = buildNewWorldPlan(42, "NORMAL");
    const homeByKey = new Map(NPC_GUILD_TEMPLATES.map((t) => [t.key, t.homeRegionId]));
    for (const port of plan.ports) {
      const region = PORTS.find((p) => p.id === port.portId)!.regionId;
      for (const inf of port.influences) {
        if (inf.guildKey === "LOCAL") continue;
        expect(homeByKey.get(inf.guildKey), `${inf.guildKey}@${port.portId}`).toBe(region);
      }
    }
  });

  it("sets up the starter fleet and two officers", () => {
    const plan = buildNewWorldPlan(11, "NORMAL");
    expect(plan.officers).toHaveLength(2);
    expect(plan.homePortId).toBe("port.amber_gulf.aurelia");
    expect(plan.starterCrew).toBeGreaterThan(0);
    for (const officer of plan.officers) {
      for (const v of Object.values(officer.stats)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it("distributes every remaining officer template to a tavern respecting minPortSize", () => {
    const plan = buildNewWorldPlan(11, "NORMAL");
    expect(plan.tavernOfficers).toHaveLength(10); // 12 templates - 2 starting
    const portByIdMap = new Map(PORTS.map((p) => [p.id, p]));
    for (const officer of plan.tavernOfficers) {
      const port = portByIdMap.get(officer.locationPortId);
      expect(port, officer.locationPortId).toBeDefined();
      const template = OFFICER_TEMPLATES.find((t) => t.key === officer.templateKey)!;
      expect(port!.size).toBeGreaterThanOrEqual(template.minPortSize);
    }
    // 起始兩位不應重複出現在酒館池
    const startingKeys = new Set(["off.sera_vandel", "off.bram_holt"]);
    expect(plan.tavernOfficers.some((o) => startingKeys.has(o.templateKey))).toBe(false);
  });
});
