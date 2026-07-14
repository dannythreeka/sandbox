import { describe, expect, it } from "vitest";
import { advanceClock, applyEffect } from "./effect";
import { createInitialSaveState } from "./types";

function baseState() {
  return createInitialSaveState({ startSceneId: "s1", startAreaId: "a1", startRegionId: "r1" });
}

describe("applyEffect", () => {
  it("adds flags without duplicates and does not mutate input", () => {
    const state = baseState();
    const next = applyEffect({ setFlags: ["flag.a"] }, state);
    expect(state.flags).toEqual([]);
    expect(next.flags).toEqual(["flag.a"]);
    const next2 = applyEffect({ setFlags: ["flag.a", "flag.b"] }, next);
    expect(next2.flags).toEqual(["flag.a", "flag.b"]);
  });

  it("applies worldState delta and set at nested paths", () => {
    const state = baseState();
    const next = applyEffect({ worldState: [{ path: "crimsonThreat", delta: 10 }] }, state);
    expect(next.worldState.crimsonThreat).toBe(10);
    const next2 = applyEffect({ worldState: [{ path: "guildOrder.npc.crimson_sails", set: 30 }] }, next);
    expect(next2.worldState.guildOrder["npc.crimson_sails"]).toBe(30);
    const next3 = applyEffect({ worldState: [{ path: "guildOrder.npc.crimson_sails", delta: 5 }] }, next2);
    expect(next3.worldState.guildOrder["npc.crimson_sails"]).toBe(35);
  });

  it("accumulates affinity and reputation deltas", () => {
    const state = baseState();
    const next = applyEffect(
      { affinity: [{ npc: "npc.kohl", delta: 15 }], reputation: [{ area: "area.aurelia", delta: 5 }] },
      state,
    );
    expect(next.affinity["npc.kohl"]).toBe(15);
    expect(next.reputation["area.aurelia"]).toBe(5);
    const next2 = applyEffect({ affinity: [{ npc: "npc.kohl", delta: 5 }] }, next);
    expect(next2.affinity["npc.kohl"]).toBe(20);
  });

  it("unlocks regions/areas/scenes without duplication", () => {
    const state = baseState();
    const next = applyEffect({ unlock: { areas: ["area.perlan"], scenes: ["scene.perlan.docks"] } }, state);
    expect(next.unlocked.areas).toContain("area.perlan");
    expect(next.unlocked.scenes).toContain("scene.perlan.docks");
    const next2 = applyEffect({ unlock: { areas: ["area.perlan"] } }, next);
    expect(next2.unlocked.areas.filter((a) => a === "area.perlan")).toHaveLength(1);
  });

  it("advances clock through phases into the next day", () => {
    const state = baseState();
    expect(state.clock).toEqual({ day: 1, phase: "DAWN", season: "SPRING" });
    const next = applyEffect({ advanceTime: 1 }, state);
    expect(next.clock.phase).toBe("DAY");
    expect(next.clock.day).toBe(1);
    const next2 = applyEffect({ advanceTime: 4 }, next);
    expect(next2.clock).toEqual({ day: 2, phase: "DAY", season: "SPRING" });
  });

  it("gives items", () => {
    const state = baseState();
    const next = applyEffect({ giveItem: ["item.perlan_salt"] }, state);
    expect(next.inventory).toEqual(["item.perlan_salt"]);
  });
});

describe("advanceClock", () => {
  it("wraps phase index and increments day on rollover", () => {
    const clock = advanceClock({ day: 1, phase: "NIGHT", season: "SPRING" }, 1);
    expect(clock).toEqual({ day: 2, phase: "DAWN", season: "SPRING" });
  });
});
