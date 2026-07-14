import { describe, expect, it } from "vitest";
import { RpgEngine, evaluateCondition, validateContent } from "@azure-voyage/rpg-engine";
import { AZURE_VOYAGE_RPG_CONTENT as content, createStartState } from "./content";

function newEngine(rng: () => number = () => 1) {
  return new RpgEngine(content, createStartState(), rng);
}

/** 一路 continue 直到需要玩家輸入（choice）或事件結束。 */
function drain(engine: RpgEngine) {
  let node = engine.continue();
  while (node.kind === "dialogue" || node.kind === "checkResult") node = engine.continue();
  return node;
}

describe("AZURE_VOYAGE_RPG_CONTENT", () => {
  it("has no dangling references", () => {
    expect(validateContent(content)).toEqual([]);
  });

  it("every quest objective condition is well-formed against a fresh state", () => {
    const state = createStartState();
    for (const quest of Object.values(content.quests)) {
      for (const objective of quest.objectives) {
        expect(() => evaluateCondition(objective.completeWhen, state)).not.toThrow();
      }
    }
  });
});

describe("main quest chain playthrough (favorable rng)", () => {
  it("plays opening -> recruit crew -> first trade -> first battle -> unlocks Perlan -> side quest", () => {
    const engine = newEngine(() => 1); // 高擾動，讓五維判定盡量成功

    // ── 開場：港務廳長桌（白天開）──
    let node = engine.interact("hotspot.harbor_office.desk");
    expect(node?.kind).toBe("dialogue");
    node = drain(engine);
    expect(node.kind).toBe("choice");
    node = engine.choose(0);
    node = drain(engine);
    expect(node.kind).toBe("end");
    expect(engine.state.flags).toContain("flag.game_started");
    expect(engine.state.clock.phase).toBe("DAY"); // opening 事件推進了 1 個時段

    // ── 等到傍晚，酒館開門，招募布拉姆與賽菈 ──
    engine.advanceTime(1); // DAY -> DUSK
    engine.travelTo("scene.aurelia.tavern");

    node = engine.interact("hotspot.tavern.bar"); // 只有 recruit_bram 符合前置條件
    expect(node?.kind).toBe("dialogue");
    node = drain(engine);
    expect(node.kind).toBe("end");
    expect(engine.state.flags).toContain("flag.recruited_bram");

    node = engine.interact("hotspot.tavern.bar"); // 現在輪到 recruit_sera
    expect(node?.kind).toBe("dialogue");
    node = drain(engine);
    expect(node.kind).toBe("end");
    expect(engine.state.flags).toContain("flag.crew_assembled");

    // ── 等到隔天白天，市場開門，完成第一筆交易 ──
    engine.advanceTime(3); // DUSK -> NIGHT -> DAWN(+1day) -> DAY
    expect(engine.state.clock.phase).toBe("DAY");
    engine.travelTo("scene.aurelia.market");

    node = engine.interact("hotspot.market.stalls");
    expect(node?.kind).toBe("dialogue");
    node = drain(engine);
    expect(node.kind).toBe("end");
    expect(engine.state.flags).toContain("flag.first_trade_done");

    // ── 緋帆團初現：碼頭瞭望（crew_assembled 後才會出現的熱點）──
    node = engine.interact("hotspot.market.lookout");
    expect(node?.kind).toBe("dialogue");
    node = drain(engine);
    expect(node.kind).toBe("choice");
    node = engine.choose(0); // 迎上去正面周旋
    expect(node.kind).toBe("checkResult");
    node = drain(engine);
    expect(node.kind).toBe("end");
    expect(engine.state.flags).toContain("flag.first_battle_done");
    expect(engine.state.worldState.crimsonThreat).toBe(10);
    expect(engine.state.unlocked.areas).toContain("area.perlan");
    expect(engine.state.unlocked.scenes).toContain("scene.perlan.docks");

    // ── 佩爾蘭支線：老漁夫圖克 ──
    engine.travelTo("scene.perlan.docks");
    node = engine.interact("hotspot.perlan.old_fisherman"); // 只有 meet_tuk 符合條件
    expect(node?.kind).toBe("dialogue");
    node = drain(engine);
    expect(node.kind).toBe("choice");
    node = engine.choose(0); // 答應幫忙重開鹽田
    node = drain(engine);
    expect(node.kind).toBe("end");
    expect(engine.state.flags).toContain("flag.perlan_help_promised");
    expect(engine.state.affinity["npc.tuk"]).toBe(20);

    node = engine.interact("hotspot.perlan.old_fisherman"); // 現在輪到 saltfield_reopened
    expect(node?.kind).toBe("dialogue");
    node = drain(engine);
    expect(node.kind).toBe("end");
    expect(engine.state.flags).toContain("flag.perlan_quest_completed");
    expect(engine.state.inventory).toContain("item.perlan_salt");
    expect(engine.state.reputation["area.perlan"]).toBe(10);

    // ── 主線任務目標此刻應全數判定為完成 ──
    for (const questId of ["quest.ch1_first_trade", "quest.ch2_crew", "quest.ch3_first_battle", "quest.side_perlan"]) {
      const quest = content.quests[questId];
      for (const objective of quest.objectives) {
        expect(evaluateCondition(objective.completeWhen, engine.state)).toBe(true);
      }
    }
  });

  it("declining the Perlan quest leaves the saltfield event permanently unreachable", () => {
    const engine = newEngine(() => 1);
    // 快轉到緋帆團事件解鎖佩爾蘭：直接操作旗標以跳過前置流程，只驗證拒絕分支。
    engine.interact("hotspot.harbor_office.desk");
    drain(engine);
    engine.choose(0);
    drain(engine);
    engine.advanceTime(1);
    engine.travelTo("scene.aurelia.tavern");
    engine.interact("hotspot.tavern.bar"); // recruit_bram
    drain(engine);
    engine.interact("hotspot.tavern.bar"); // recruit_sera
    drain(engine);
    engine.advanceTime(3);
    engine.travelTo("scene.aurelia.market");
    engine.interact("hotspot.market.stalls");
    drain(engine);
    engine.interact("hotspot.market.lookout");
    drain(engine);
    engine.choose(0);
    drain(engine);

    engine.travelTo("scene.perlan.docks");
    engine.interact("hotspot.perlan.old_fisherman");
    drain(engine);
    engine.choose(1); // 拒絕幫忙
    drain(engine);
    expect(engine.state.flags).toContain("flag.perlan_declined");

    const second = engine.interact("hotspot.perlan.old_fisherman");
    expect(second).toBeNull(); // meet_tuk 已完成（once），saltfield_reopened 前置條件不成立
  });
});
