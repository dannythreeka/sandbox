/**
 * 海戰解算（docs/01 §4.4、docs/05 §5）。
 * M5 簡化：戰場是獨立的小型 axial 六角棋盤（不含地形/風向），回合順序依速度排序；
 * 接舷戰簡化為「近戰傷害判定」而非完整的俘虜/易主流程（留給後續打磨）。
 * 一切隨機經由 seeded Rng 注入，同 seed + 同動作序列必重現同結果。
 */
import type { ShipClassDef } from "../content/shipClasses";
import { hexDistance, type AxialCoord } from "./hex";
import { deriveSeed, Rng } from "./rng";

export const BOARD_RADIUS = 5;

export type BattleUnitSide = "PLAYER" | "ENEMY";

export interface BattleUnit {
  id: string;
  side: BattleUnitSide;
  name: string;
  shipClassId: string;
  pos: AxialCoord;
  hull: number;
  maxHull: number;
  crew: number;
  maxCrew: number;
  cannons: number;
  speed: number;
  fled: boolean;
  destroyed: boolean;
}

export interface BattleState {
  round: number;
  units: BattleUnit[];
  /** 本回合尚未行動的 unit id（依速度排序初始化，行動後移除） */
  pendingUnitIds: string[];
}

export type BattleAction =
  | { type: "MOVE"; unitId: string; to: AxialCoord }
  | { type: "FIRE"; unitId: string; targetId: string }
  | { type: "BOARD"; unitId: string; targetId: string }
  | { type: "REPAIR"; unitId: string }
  | { type: "FLEE"; unitId: string };

export interface BattleActionResult {
  state: BattleState;
  log: string;
  battleOver?: "PLAYER_WIN" | "PLAYER_LOSE" | "FLED";
}

const FIRE_RANGE = 4;
const REPAIR_AMOUNT_RATIO = 0.15;
const FLEE_BASE_CHANCE = 0.5;

export function unitFromShip(
  id: string,
  side: BattleUnitSide,
  name: string,
  shipClass: ShipClassDef,
  pos: AxialCoord,
  hull: number,
  crew: number,
): BattleUnit {
  return {
    id,
    side,
    name,
    shipClassId: shipClass.id,
    pos,
    hull,
    maxHull: shipClass.maxHull,
    crew,
    maxCrew: shipClass.crewMax,
    cannons: shipClass.cannonSlots,
    speed: shipClass.speed,
    fled: false,
    destroyed: false,
  };
}

export function initBattleState(units: BattleUnit[]): BattleState {
  const order = [...units].sort((a, b) => b.speed - a.speed).map((u) => u.id);
  return { round: 1, units, pendingUnitIds: order };
}

function aliveUnits(state: BattleState, side?: BattleUnitSide): BattleUnit[] {
  return state.units.filter((u) => !u.destroyed && !u.fled && (side === undefined || u.side === side));
}

function checkOutcome(state: BattleState): BattleActionResult["battleOver"] {
  const playerAlive = aliveUnits(state, "PLAYER");
  const enemyAlive = aliveUnits(state, "ENEMY");
  if (playerAlive.length === 0) return "PLAYER_LOSE";
  if (enemyAlive.length === 0) return "PLAYER_WIN";
  return undefined;
}

function moveRange(unit: BattleUnit): number {
  return Math.max(1, Math.floor(unit.speed / 12));
}

/** 套用一個動作，回傳新狀態（不修改輸入）。純函式，供 API 層與測試共用。 */
export function applyBattleAction(state: BattleState, action: BattleAction, rng: Rng): BattleActionResult {
  const units = state.units.map((u) => ({ ...u }));
  const byId = new Map(units.map((u) => [u.id, u]));
  const actor = byId.get(action.unitId);
  if (!actor || actor.destroyed || actor.fled) {
    throw new Error(`invalid actor: ${action.unitId}`);
  }
  if (!state.pendingUnitIds.includes(action.unitId)) {
    throw new Error(`unit ${action.unitId} has already acted this round`);
  }

  let log = "";
  switch (action.type) {
    case "MOVE": {
      const dist = hexDistance(actor.pos, action.to);
      if (dist > moveRange(actor)) throw new Error("move exceeds range");
      actor.pos = action.to;
      log = `${actor.name} 移動至 (${action.to.q},${action.to.r})`;
      break;
    }
    case "FIRE": {
      const target = byId.get(action.targetId);
      if (!target || target.destroyed || target.fled) throw new Error("invalid target");
      const dist = hexDistance(actor.pos, target.pos);
      if (dist > FIRE_RANGE) throw new Error("target out of range");
      const rangeFalloff = Math.max(0.5, 1 - dist / (FIRE_RANGE + 1));
      const rawDamage = actor.cannons * (6 + rng.int(0, 6)) * rangeFalloff;
      const damage = Math.max(1, Math.round(rawDamage));
      target.hull = Math.max(0, target.hull - damage);
      log = `${actor.name} 砲擊 ${target.name}，造成 ${damage} 點傷害`;
      if (target.hull === 0) {
        target.destroyed = true;
        log += `，${target.name} 沉沒！`;
      }
      break;
    }
    case "BOARD": {
      const target = byId.get(action.targetId);
      if (!target || target.destroyed || target.fled) throw new Error("invalid target");
      if (hexDistance(actor.pos, target.pos) > 1) throw new Error("target not adjacent");
      const actorPower = actor.crew * (0.8 + rng.float() * 0.4);
      const targetPower = target.crew * (0.8 + rng.float() * 0.4);
      if (actorPower > targetPower) {
        const crewLoss = Math.round(target.crew * 0.5);
        target.crew = Math.max(0, target.crew - crewLoss);
        target.hull = Math.max(0, target.hull - Math.round(target.maxHull * 0.2));
        log = `${actor.name} 接舷突襲得手，${target.name} 損失慘重`;
        if (target.crew === 0 || target.hull === 0) {
          target.destroyed = true;
          log += `，${target.name} 遭擊沉／棄船！`;
        }
      } else {
        const crewLoss = Math.round(actor.crew * 0.3);
        actor.crew = Math.max(0, actor.crew - crewLoss);
        log = `${actor.name} 接舷失利，損失部分船員`;
      }
      break;
    }
    case "REPAIR": {
      const amount = Math.round(actor.maxHull * REPAIR_AMOUNT_RATIO);
      actor.hull = Math.min(actor.maxHull, actor.hull + amount);
      log = `${actor.name} 進行緊急搶修，恢復 ${amount} 點耐久`;
      break;
    }
    case "FLEE": {
      const chance = FLEE_BASE_CHANCE + (1 - actor.hull / actor.maxHull) * 0.2;
      if (rng.chance(chance)) {
        actor.fled = true;
        log = `${actor.name} 成功脫離戰場`;
      } else {
        log = `${actor.name} 逃跑失敗`;
      }
      break;
    }
  }

  // 移除本次行動者，以及「本回合尚未行動、但被這次行動波及而沉沒/逃離」的其他單位
  // ——否則等到那個 id 輪到時，會嘗試讓一艘已經不存在的船「行動」而拋錯（曾實際觸發過）。
  const pendingUnitIds = state.pendingUnitIds.filter((id) => {
    if (id === action.unitId) return false;
    const u = byId.get(id);
    return u !== undefined && !u.destroyed && !u.fled;
  });
  let nextState: BattleState = { round: state.round, units, pendingUnitIds };

  const battleOver = checkOutcome(nextState);
  if (battleOver) return { state: nextState, log, battleOver };

  if (nextState.pendingUnitIds.length === 0) {
    const order = aliveUnits(nextState)
      .sort((a, b) => b.speed - a.speed)
      .map((u) => u.id);
    nextState = { round: nextState.round + 1, units: nextState.units, pendingUnitIds: order };
  }

  return { state: nextState, log };
}

/** 敵方回合制簡易 AI（docs/05 §5）：非 LLM，確定性規則，保證即時。 */
export function decideEnemyAction(state: BattleState, unitId: string, rng: Rng): BattleAction {
  const unit = state.units.find((u) => u.id === unitId)!;
  const targets = aliveUnits(state, "PLAYER");
  if (targets.length === 0) return { type: "REPAIR", unitId };

  if (unit.hull / unit.maxHull < 0.25 && rng.chance(0.6)) {
    return { type: "FLEE", unitId };
  }

  const nearest = [...targets].sort(
    (a, b) => hexDistance(unit.pos, a.pos) - hexDistance(unit.pos, b.pos),
  )[0];
  const dist = hexDistance(unit.pos, nearest.pos);

  if (dist <= FIRE_RANGE) {
    return { type: "FIRE", unitId, targetId: nearest.id };
  }
  const step = moveRange(unit);
  const dq = Math.sign(nearest.pos.q - unit.pos.q) * Math.min(step, Math.abs(nearest.pos.q - unit.pos.q));
  const dr = Math.sign(nearest.pos.r - unit.pos.r) * Math.min(step, Math.abs(nearest.pos.r - unit.pos.r));
  return { type: "MOVE", unitId, to: { q: unit.pos.q + dq, r: unit.pos.r + dr } };
}

export interface AutoResolveResult {
  state: BattleState;
  logs: string[];
  nextActionIndex: number;
  battleOver?: BattleActionResult["battleOver"];
}

/**
 * 自動解算「連續的敵方回合」，直到輪到玩家或戰鬥結束（docs/05 §5）。
 * 必要：敵艦速度可能高於玩家（例如海賊船比新手帆船快），初始回合順序時敵方可能排在
 * 玩家前面——若不主動解算，玩家永遠等不到能行動的時機。呼叫端（EncounterService 建立
 * 戰鬥時、BattleService 玩家行動後）都要跑這個函式，而不是只在玩家行動後才處理。
 */
export function autoResolveEnemyTurns(
  state: BattleState,
  seed: number,
  startActionIndex: number,
): AutoResolveResult {
  let current = state;
  let idx = startActionIndex;
  const logs: string[] = [];
  let outcome: BattleActionResult["battleOver"];

  while (!outcome) {
    const nextId = current.pendingUnitIds[0];
    if (!nextId) break;
    const nextUnit = current.units.find((u) => u.id === nextId)!;
    if (nextUnit.side === "PLAYER") break;

    const decisionRng = new Rng(deriveSeed(seed, current.round, idx));
    const action = decideEnemyAction(current, nextId, decisionRng);
    const resolveRng = new Rng(deriveSeed(seed, current.round, idx + 1));
    idx += 2;

    const result = applyBattleAction(current, action, resolveRng);
    current = result.state;
    logs.push(result.log);
    if (result.battleOver) outcome = result.battleOver;
  }

  return { state: current, logs, nextActionIndex: idx, battleOver: outcome };
}
