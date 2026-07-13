import { describe, expect, it } from "vitest";
import { NPC_GOAL_KINDS, AiEventProposalSchema, NpcPersonaGenSchema, NpcStrategySchema } from "../schemas/ai";
import { PORT_NOTABLE_ARCHETYPES } from "../content/portNotables";
import { fallbackNpcStrategy, fallbackPortNotablePersonaGen, fallbackRumorEvent } from "./aiFallback";

describe("fallbackNpcStrategy", () => {
  it("produces a schema-valid strategy with exactly one goal in the home region", () => {
    const strategy = fallbackNpcStrategy({ seed: 42, tick: 100, homeRegionId: "region.amber_gulf" });
    expect(NpcStrategySchema.safeParse(strategy).success).toBe(true);
    expect(strategy.goals).toHaveLength(1);
    expect(strategy.goals[0].regionId).toBe("region.amber_gulf");
    expect(NPC_GOAL_KINDS).toContain(strategy.goals[0].kind);
    expect(strategy.validUntilTick).toBeGreaterThan(100);
  });

  it("is deterministic for a fixed seed", () => {
    const a = fallbackNpcStrategy({ seed: 7, tick: 10, homeRegionId: "region.ironcliff" });
    const b = fallbackNpcStrategy({ seed: 7, tick: 10, homeRegionId: "region.ironcliff" });
    expect(a).toEqual(b);
  });

  it("varies goal kind across different seeds", () => {
    const kinds = new Set(
      Array.from({ length: 20 }, (_, i) =>
        fallbackNpcStrategy({ seed: i, tick: 0, homeRegionId: "region.silkwind" }).goals[0].kind,
      ),
    );
    expect(kinds.size).toBeGreaterThan(1);
  });
});

describe("fallbackRumorEvent", () => {
  it("produces a schema-valid RUMOR proposal mentioning the port name", () => {
    const event = fallbackRumorEvent({ seed: 1, portName: "霜港" });
    expect(AiEventProposalSchema.safeParse(event).success).toBe(true);
    expect(event.type).toBe("RUMOR");
    expect(event.narrative).toContain("霜港");
    expect(event.goldReward).toBeGreaterThanOrEqual(50);
    expect(event.fameReward).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic for a fixed seed", () => {
    const a = fallbackRumorEvent({ seed: 99, portName: "奧雷利亞" });
    const b = fallbackRumorEvent({ seed: 99, portName: "奧雷利亞" });
    expect(a).toEqual(b);
  });
});

describe("fallbackPortNotablePersonaGen", () => {
  it("produces a schema-valid persona mentioning the notable's name for every archetype", () => {
    for (const archetype of PORT_NOTABLE_ARCHETYPES) {
      const persona = fallbackPortNotablePersonaGen({ name: "測試人物", portName: "測試港", archetype });
      expect(NpcPersonaGenSchema.safeParse(persona).success).toBe(true);
      expect(persona.description).toContain("測試人物");
      expect(persona.greeting).toContain("測試人物");
    }
  });
});
