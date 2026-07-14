import { describe, expect, it } from "vitest";
import { RpgEngine, pickEligibleEvent } from "./engine";
import { validateContent } from "./validate";
import { createInitialSaveState, type ContentPack, type GameEvent, type Hotspot, type SaveState } from "./types";

function testContent(): ContentPack {
  const greetEvent: GameEvent = {
    id: "event.greet",
    precondition: { kind: "always" },
    weight: 1,
    once: true,
    entryNodeId: "n1",
    nodes: [
      { kind: "dialogue", id: "n1", speaker: "馬瑟斯", text: "歡迎來到奧雷利亞。", goto: "n2" },
      {
        kind: "choice",
        id: "n2",
        prompt: "你要？",
        options: [
          { label: "接下委託", goto: "n3" },
          { label: "先離開", goto: "n4" },
        ],
      },
      {
        kind: "effect",
        id: "n3",
        effect: { setFlags: ["flag.took_job"], affinity: [{ npc: "npc.mathers", delta: 10 }] },
        goto: "n5",
      },
      { kind: "dialogue", id: "n5", speaker: "馬瑟斯", text: "很好，出發吧。", goto: "END" },
      { kind: "dialogue", id: "n4", speaker: "旁白", text: "你轉身離開了。", goto: "END" },
    ],
  };

  const skillEvent: GameEvent = {
    id: "event.skill_check",
    precondition: { kind: "flag", flag: "flag.took_job", value: true },
    weight: 1,
    once: false,
    cooldownDays: 1,
    entryNodeId: "c1",
    nodes: [
      { kind: "skillCheck", id: "c1", stat: "lore", difficulty: 5, onSuccess: "c_win", onFailure: "c_lose" },
      { kind: "dialogue", id: "c_win", speaker: "旁白", text: "你看懂了。", goto: "END" },
      { kind: "dialogue", id: "c_lose", speaker: "旁白", text: "你沒看懂。", goto: "END" },
    ],
  };

  const rareEvent: GameEvent = {
    id: "event.rare",
    precondition: { kind: "always" },
    weight: 0,
    once: false,
    entryNodeId: "r1",
    nodes: [{ kind: "dialogue", id: "r1", speaker: "旁白", text: "稀有事件。", goto: "END" }],
  };

  const hotspot: Hotspot = {
    id: "hotspot.desk",
    label: "港務廳長桌",
    eventPool: ["event.greet", "event.skill_check", "event.rare"],
  };

  return {
    regions: {
      "region.amber_gulf": { id: "region.amber_gulf", name: "琥珀灣", unlockCondition: { kind: "always" }, areas: ["area.aurelia"] },
    },
    areas: {
      "area.aurelia": {
        id: "area.aurelia",
        regionId: "region.amber_gulf",
        name: "奧雷利亞",
        kind: "PORT",
        unlockCondition: { kind: "always" },
        scenes: ["scene.aurelia.harbor_office"],
      },
    },
    scenes: {
      "scene.aurelia.harbor_office": {
        id: "scene.aurelia.harbor_office",
        areaId: "area.aurelia",
        name: "港務廳",
        hotspots: [hotspot],
      },
    },
    events: { [greetEvent.id]: greetEvent, [skillEvent.id]: skillEvent, [rareEvent.id]: rareEvent },
    npcs: {},
    quests: {},
    startSceneId: "scene.aurelia.harbor_office",
  };
}

function newState(): SaveState {
  return createInitialSaveState({
    startSceneId: "scene.aurelia.harbor_office",
    startAreaId: "area.aurelia",
    startRegionId: "region.amber_gulf",
  });
}

describe("validateContent", () => {
  it("passes for a well-formed content pack", () => {
    expect(validateContent(testContent())).toEqual([]);
  });

  it("catches dangling references", () => {
    const content = testContent();
    content.scenes["scene.aurelia.harbor_office"].hotspots[0].eventPool.push("event.missing");
    const errors = validateContent(content);
    expect(errors.some((e) => e.includes("event.missing"))).toBe(true);
  });
});

describe("pickEligibleEvent", () => {
  it("never picks a zero-weight event and respects preconditions", () => {
    const content = testContent();
    const hotspot = content.scenes["scene.aurelia.harbor_office"].hotspots[0];
    const state = newState();
    for (let i = 0; i < 20; i++) {
      const ev = pickEligibleEvent(hotspot, content, state, Math.random);
      expect(ev?.id).not.toBe("event.rare");
      // skill_check 尚未滿足 precondition（flag.took_job 未設），只剩 greet 可選
      expect(ev?.id).toBe("event.greet");
    }
  });
});

describe("RpgEngine time gating", () => {
  it("reports scenes as closed outside their timeGate and blocks travelTo", () => {
    const content = testContent();
    content.scenes["scene.aurelia.harbor_office"].timeGate = { phases: ["DAWN", "DAY"] };
    const engine = new RpgEngine(content, { ...newState(), clock: { day: 1, phase: "NIGHT", season: "SPRING" } });

    const view = engine.getAreaView("area.aurelia");
    expect(view.scenes[0].open).toBe(false);
    expect(() => engine.travelTo("scene.aurelia.harbor_office")).toThrow();
  });

  it("allows travel once the clock is inside the timeGate", () => {
    const content = testContent();
    content.scenes["scene.aurelia.harbor_office"].timeGate = { phases: ["DAWN", "DAY"] };
    const engine = new RpgEngine(content, { ...newState(), clock: { day: 1, phase: "DAY", season: "SPRING" } });

    expect(engine.getAreaView("area.aurelia").scenes[0].open).toBe(true);
    expect(() => engine.travelTo("scene.aurelia.harbor_office")).not.toThrow();
  });
});

describe("RpgEngine full playthrough", () => {
  it("plays through dialogue -> choice -> effect -> dialogue -> end, applying effects", () => {
    const engine = new RpgEngine(testContent(), newState(), () => 0);
    let node = engine.interact("hotspot.desk");
    expect(node?.kind).toBe("dialogue");
    node = engine.continue();
    expect(node?.kind).toBe("choice");
    if (node?.kind !== "choice") throw new Error("expected choice");
    expect(node.options.map((o) => o.label)).toEqual(["接下委託", "先離開"]);

    node = engine.choose(0); // 接下委託
    expect(node.kind).toBe("dialogue");
    node = engine.continue();
    expect(node.kind).toBe("end");

    expect(engine.state.flags).toContain("flag.took_job");
    expect(engine.state.affinity["npc.mathers"]).toBe(10);
    expect(engine.state.eventHistory["event.greet"].count).toBe(1);
  });

  it("does not re-offer a once event on the second interaction", () => {
    const engine = new RpgEngine(testContent(), newState(), () => 0);
    let node = engine.interact("hotspot.desk");
    node = engine.continue();
    node = engine.choose(1); // 先離開
    node = engine.continue();
    expect(node.kind).toBe("end");

    // 第二次互動：greet 已完成（once），現在 flag.took_job 仍未設（選了離開），
    // skill_check 前置條件不成立，rare 權重 0 —— 應該沒有事件可觸發。
    const second = engine.interact("hotspot.desk");
    expect(second).toBeNull();
  });

  it("resolves a skill check deterministically via injected rng", () => {
    // 排除 event.greet（once 已完成）讓熱點只剩 event.skill_check 可抽,
    // 才能確定性地測到判定節點,不受「兩個事件都符合條件時隨機抽中誰」影響。
    const stateWithJob = (): SaveState => ({
      ...newState(),
      flags: ["flag.took_job"],
      eventHistory: { "event.greet": { count: 1, lastAtDay: 1 } },
    });

    // rng() 恆回傳 1 → spread = floor(1*21)-10 = 11，lore(20)+11=31 >= difficulty(5) → 成功
    const winEngine = new RpgEngine(testContent(), stateWithJob(), () => 1);
    const win = winEngine.interact("hotspot.desk");
    expect(win?.kind).toBe("checkResult");
    if (win?.kind !== "checkResult") throw new Error("expected checkResult");
    expect(win.success).toBe(true);
    const after = winEngine.continue();
    expect(after.kind).toBe("dialogue");

    // 改用高難度事件驗證失敗路徑
    const content = testContent();
    content.events["event.skill_check"].nodes[0] = {
      kind: "skillCheck",
      id: "c1",
      stat: "lore",
      difficulty: 50,
      onSuccess: "c_win",
      onFailure: "c_lose",
    };
    const loseEngine = new RpgEngine(content, stateWithJob(), () => 0);
    const lose = loseEngine.interact("hotspot.desk");
    expect(lose?.kind).toBe("checkResult");
    if (lose?.kind !== "checkResult") throw new Error("expected checkResult");
    expect(lose.success).toBe(false);
  });
});
