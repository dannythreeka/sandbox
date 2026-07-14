import { describe, expect, it } from "vitest";
import { evaluateCondition } from "./condition";
import { createInitialSaveState, type SaveState } from "./types";

function baseState(overrides: Partial<SaveState> = {}): SaveState {
  return {
    ...createInitialSaveState({ startSceneId: "s1", startAreaId: "a1", startRegionId: "r1" }),
    ...overrides,
  };
}

describe("evaluateCondition", () => {
  it("always is true", () => {
    expect(evaluateCondition({ kind: "always" }, baseState())).toBe(true);
  });

  it("flag matches presence/absence", () => {
    const state = baseState({ flags: ["flag.met_kohl"] });
    expect(evaluateCondition({ kind: "flag", flag: "flag.met_kohl", value: true }, state)).toBe(true);
    expect(evaluateCondition({ kind: "flag", flag: "flag.met_kohl", value: false }, state)).toBe(false);
    expect(evaluateCondition({ kind: "flag", flag: "flag.other", value: false }, state)).toBe(true);
  });

  it("worldState reads nested path with dot notation", () => {
    const state = baseState();
    state.worldState.guildOrder["npc.crimson_sails"] = 55;
    expect(
      evaluateCondition({ kind: "worldState", path: "guildOrder.npc.crimson_sails", op: ">=", value: 50 }, state),
    ).toBe(true);
    expect(
      evaluateCondition({ kind: "worldState", path: "guildOrder.npc.crimson_sails", op: ">=", value: 60 }, state),
    ).toBe(false);
    expect(evaluateCondition({ kind: "worldState", path: "seaOmen", op: "==", value: "CALM" }, state)).toBe(true);
  });

  it("stat/affinity/reputation/exploration compare with defaults of 0", () => {
    const state = baseState();
    expect(evaluateCondition({ kind: "stat", stat: "lore", op: ">=", value: 20 }, state)).toBe(true);
    expect(evaluateCondition({ kind: "affinity", npc: "npc.kohl", op: ">=", value: 1 }, state)).toBe(false);
    state.affinity["npc.kohl"] = 40;
    expect(evaluateCondition({ kind: "affinity", npc: "npc.kohl", op: ">=", value: 40 }, state)).toBe(true);
  });

  it("time window checks phase/season/day range", () => {
    const state = baseState();
    state.clock = { day: 5, phase: "NIGHT", season: "SUMMER" };
    expect(evaluateCondition({ kind: "time", window: { phases: ["NIGHT"] } }, state)).toBe(true);
    expect(evaluateCondition({ kind: "time", window: { phases: ["DAY"] } }, state)).toBe(false);
    expect(evaluateCondition({ kind: "time", window: { minDay: 10 } }, state)).toBe(false);
    expect(evaluateCondition({ kind: "time", window: { minDay: 1, maxDay: 10 } }, state)).toBe(true);
  });

  it("eventCompleted checks history count", () => {
    const state = baseState();
    expect(evaluateCondition({ kind: "eventCompleted", event: "event.x" }, state)).toBe(false);
    state.eventHistory["event.x"] = { count: 1, lastAtDay: 1 };
    expect(evaluateCondition({ kind: "eventCompleted", event: "event.x" }, state)).toBe(true);
  });

  it("and/or/not combinators", () => {
    const state = baseState({ flags: ["flag.a"] });
    expect(
      evaluateCondition(
        { kind: "and", all: [{ kind: "flag", flag: "flag.a", value: true }, { kind: "always" }] },
        state,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { kind: "or", any: [{ kind: "flag", flag: "flag.b", value: true }, { kind: "flag", flag: "flag.a", value: true }] },
        state,
      ),
    ).toBe(true);
    expect(evaluateCondition({ kind: "not", cond: { kind: "flag", flag: "flag.a", value: true } }, state)).toBe(
      false,
    );
  });
});
