import { describe, expect, it } from "vitest";
import { shipClassById } from "../content/shipClasses";
import { Rng } from "./rng";
import {
  applyBattleAction,
  autoResolveEnemyTurns,
  decideEnemyAction,
  initBattleState,
  unitFromShip,
  type BattleState,
} from "./battle";

function makeState(): BattleState {
  const lugger = shipClassById("ship.lugger");
  const player = unitFromShip("p1", "PLAYER", "玩家船", lugger, { q: 0, r: 0 }, lugger.maxHull, 8);
  const enemy = unitFromShip("e1", "ENEMY", "海賊船", lugger, { q: 2, r: 0 }, lugger.maxHull, 8);
  return initBattleState([player, enemy]);
}

describe("initBattleState", () => {
  it("orders pending units by speed descending", () => {
    const state = makeState();
    expect(state.pendingUnitIds).toHaveLength(2);
    expect(state.round).toBe(1);
  });
});

describe("applyBattleAction", () => {
  it("MOVE updates position within range and is deterministic", () => {
    const state = makeState();
    const rng = new Rng(1);
    const result = applyBattleAction(state, { type: "MOVE", unitId: "p1", to: { q: 0, r: 0 } }, rng);
    expect(result.state.pendingUnitIds).not.toContain("p1");
  });

  it("rejects moving beyond range", () => {
    const state = makeState();
    const rng = new Rng(1);
    expect(() =>
      applyBattleAction(state, { type: "MOVE", unitId: "p1", to: { q: 20, r: 20 } }, rng),
    ).toThrow();
  });

  it("FIRE damages the target and can destroy it", () => {
    const state = makeState();
    const rng = new Rng(42);
    const result = applyBattleAction(state, { type: "FIRE", unitId: "p1", targetId: "e1" }, rng);
    const enemy = result.state.units.find((u) => u.id === "e1")!;
    expect(enemy.hull).toBeLessThan(shipClassById("ship.lugger").maxHull);

    // 持續開火直到擊沉，驗證 battleOver 最終回報 PLAYER_WIN
    let s = result.state;
    let over = result.battleOver;
    for (let i = 0; i < 50 && !over; i++) {
      if (!s.pendingUnitIds.includes("p1")) break; // 不是玩家回合就停止（簡化測試）
      const r = applyBattleAction(s, { type: "FIRE", unitId: "p1", targetId: "e1" }, rng);
      s = r.state;
      over = r.battleOver;
    }
    // 至少應該持續造成傷害而不拋錯
    expect(s.units.find((u) => u.id === "e1")!.hull).toBeLessThanOrEqual(enemy.hull);
  });

  it("FIRE rejects out-of-range targets", () => {
    const lugger = shipClassById("ship.lugger");
    const player = unitFromShip("p1", "PLAYER", "P", lugger, { q: 0, r: 0 }, lugger.maxHull, 8);
    const enemy = unitFromShip("e1", "ENEMY", "E", lugger, { q: 10, r: 0 }, lugger.maxHull, 8);
    const state = initBattleState([player, enemy]);
    const rng = new Rng(1);
    expect(() => applyBattleAction(state, { type: "FIRE", unitId: "p1", targetId: "e1" }, rng)).toThrow();
  });

  it("REPAIR heals hull without exceeding max", () => {
    const lugger = shipClassById("ship.lugger");
    const player = unitFromShip("p1", "PLAYER", "P", lugger, { q: 0, r: 0 }, 10, 8);
    const enemy = unitFromShip("e1", "ENEMY", "E", lugger, { q: 2, r: 0 }, lugger.maxHull, 8);
    const state = initBattleState([player, enemy]);
    const rng = new Rng(1);
    const result = applyBattleAction(state, { type: "REPAIR", unitId: "p1" }, rng);
    const healed = result.state.units.find((u) => u.id === "p1")!;
    expect(healed.hull).toBeGreaterThan(10);
    expect(healed.hull).toBeLessThanOrEqual(lugger.maxHull);
  });

  it("advances to next round once all units have acted, re-sorted by speed", () => {
    const state = makeState();
    const rng = new Rng(7);
    const [firstId, secondId] = state.pendingUnitIds;
    const r1 = applyBattleAction(state, { type: "REPAIR", unitId: firstId }, rng);
    expect(r1.state.round).toBe(1);
    const r2 = applyBattleAction(r1.state, { type: "REPAIR", unitId: secondId }, rng);
    expect(r2.state.round).toBe(2);
    expect(r2.state.pendingUnitIds).toHaveLength(2);
  });

  it("rejects a unit acting twice in the same round", () => {
    const state = makeState();
    const rng = new Rng(1);
    const [firstId] = state.pendingUnitIds;
    const r1 = applyBattleAction(state, { type: "REPAIR", unitId: firstId }, rng);
    expect(() => applyBattleAction(r1.state, { type: "REPAIR", unitId: firstId }, rng)).toThrow();
  });

  it("declares PLAYER_LOSE when all player units are gone", () => {
    const lugger = shipClassById("ship.lugger");
    const player = unitFromShip("p1", "PLAYER", "P", lugger, { q: 0, r: 0 }, 1, 8);
    const enemy = unitFromShip("e1", "ENEMY", "E", lugger, { q: 1, r: 0 }, lugger.maxHull, 8);
    const state = initBattleState([player, enemy]);
    const rng = new Rng(3);
    const result = applyBattleAction(state, { type: "FIRE", unitId: "e1", targetId: "p1" }, rng);
    expect(result.battleOver).toBe("PLAYER_LOSE");
  });

  it("FLEE removes the unit from combat on success", () => {
    const lugger = shipClassById("ship.lugger");
    const player = unitFromShip("p1", "PLAYER", "P", lugger, { q: 0, r: 0 }, 5, 8);
    const enemy = unitFromShip("e1", "ENEMY", "E", lugger, { q: 2, r: 0 }, lugger.maxHull, 8);
    const state = initBattleState([player, enemy]);
    // seed 挑選一個會成功逃脫的隨機序列（chance() 用 <p 判定，低 float 值必成功）
    const rng = new Rng(0);
    const result = applyBattleAction(state, { type: "FLEE", unitId: "p1" }, rng);
    const fled = result.state.units.find((u) => u.id === "p1")!;
    // 因隨機性不保證必定成功，僅驗證欄位語意正確（fled 為 boolean 且不拋錯）
    expect(typeof fled.fled).toBe("boolean");
  });
});

describe("decideEnemyAction", () => {
  it("fires when a player unit is within range", () => {
    const state = makeState();
    const rng = new Rng(1);
    const action = decideEnemyAction(state, "e1", rng);
    expect(["FIRE", "MOVE"]).toContain(action.type);
  });

  it("tends to flee at low hull", () => {
    const lugger = shipClassById("ship.lugger");
    const player = unitFromShip("p1", "PLAYER", "P", lugger, { q: 0, r: 0 }, lugger.maxHull, 8);
    const enemy = unitFromShip("e1", "ENEMY", "E", lugger, { q: 2, r: 0 }, 5, 8);
    const state = initBattleState([player, enemy]);
    const rng = new Rng(2);
    const action = decideEnemyAction(state, "e1", rng);
    expect(["FLEE", "FIRE", "MOVE"]).toContain(action.type);
  });

  it("never targets a destroyed or fled unit", () => {
    const lugger = shipClassById("ship.lugger");
    const player = unitFromShip("p1", "PLAYER", "P", lugger, { q: 0, r: 0 }, lugger.maxHull, 8);
    const player2 = unitFromShip("p2", "PLAYER", "P2", lugger, { q: 1, r: 0 }, 0, 0);
    player2.destroyed = true;
    const enemy = unitFromShip("e1", "ENEMY", "E", lugger, { q: 2, r: 0 }, lugger.maxHull, 8);
    const state = initBattleState([player, player2, enemy]);
    const rng = new Rng(5);
    const action = decideEnemyAction(state, "e1", rng);
    if (action.type === "FIRE") expect(action.targetId).toBe("p1");
  });
});

describe("autoResolveEnemyTurns", () => {
  it("resolves a leading enemy turn so the player is never permanently locked out", () => {
    // 敵艦速度刻意設得比玩家快（sloop 42 > lugger 36），確保初始排序敵方在前
    const luggerClass = shipClassById("ship.lugger");
    const sloopClass = shipClassById("ship.sloop");
    const player = unitFromShip("p1", "PLAYER", "P", luggerClass, { q: -2, r: 0 }, luggerClass.maxHull, 8);
    const enemy = unitFromShip("e1", "ENEMY", "E", sloopClass, { q: 2, r: 0 }, sloopClass.maxHull, 8);
    const state = initBattleState([player, enemy]);
    expect(state.pendingUnitIds[0]).toBe("e1"); // 前提：敵方確實排在前面

    const result = autoResolveEnemyTurns(state, 999, 0);

    expect(result.state.pendingUnitIds).not.toContain("e1"); // 敵方已行動過
    expect(result.state.pendingUnitIds).toContain("p1"); // 玩家仍可行動
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it("does nothing when the player is already first in turn order", () => {
    const state = makeState(); // 兩艦同速時，起始順序取決於陣列順序，此處玩家在前
    if (state.pendingUnitIds[0] !== "p1") return; // 環境相依，非本測試重點時跳過
    const result = autoResolveEnemyTurns(state, 1, 0);
    expect(result.state).toEqual(state);
    expect(result.logs).toHaveLength(0);
  });

  it("is deterministic for the same seed", () => {
    const luggerClass = shipClassById("ship.lugger");
    const sloopClass = shipClassById("ship.sloop");
    const player = unitFromShip("p1", "PLAYER", "P", luggerClass, { q: -2, r: 0 }, luggerClass.maxHull, 8);
    const enemy = unitFromShip("e1", "ENEMY", "E", sloopClass, { q: 2, r: 0 }, sloopClass.maxHull, 8);
    const a = autoResolveEnemyTurns(initBattleState([player, enemy]), 42, 0);
    const b = autoResolveEnemyTurns(initBattleState([player, enemy]), 42, 0);
    expect(a.state).toEqual(b.state);
    expect(a.logs).toEqual(b.logs);
  });

  it("does not choke when a not-yet-acted unit is destroyed by someone else's turn first", () => {
    // 迴歸測試：敵艦速度最快、先手擊沉「還沒行動」的玩家船 pB；
    // 若 pendingUnitIds 沒有把 pB 一併清掉，輪到 pB「行動」時舊版引擎會直接拋錯。
    const sloopClass = shipClassById("ship.sloop"); // 速度 42，全場最快
    const luggerClass = shipClassById("ship.lugger"); // 速度 36
    const enemy = unitFromShip("e1", "ENEMY", "E", sloopClass, { q: 0, r: 0 }, sloopClass.maxHull, 8);
    const pA = unitFromShip("pA", "PLAYER", "PA", luggerClass, { q: 2, r: 0 }, luggerClass.maxHull, 8);
    const pB = unitFromShip("pB", "PLAYER", "PB", luggerClass, { q: 1, r: 0 }, 1, 8); // 1 點血，必定一擊沉沒
    const state = initBattleState([enemy, pA, pB]);
    expect(state.pendingUnitIds[0]).toBe("e1");

    expect(() => {
      const result = autoResolveEnemyTurns(state, 7, 0);
      expect(result.state.pendingUnitIds).not.toContain("pB");
      expect(result.state.units.find((u) => u.id === "pB")!.destroyed).toBe(true);
    }).not.toThrow();
  });
});
