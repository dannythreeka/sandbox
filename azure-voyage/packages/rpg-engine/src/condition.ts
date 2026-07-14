import type { Condition, SaveState, TimeWindow } from "./types";

/**
 * worldState 路徑最多兩層：欄位名 + 選填的 record 鍵。鍵本身可能含有點
 * （例如 "npc.crimson_sails"），所以只在第一個點切一刀，其餘原樣當鍵，
 * 不能用 `.split(".")` 遞迴切——那會把 "npc.crimson_sails" 誤拆成三段。
 */
function splitPath(path: string): [string, string | undefined] {
  const idx = path.indexOf(".");
  if (idx === -1) return [path, undefined];
  return [path.slice(0, idx), path.slice(idx + 1)];
}

function getPath(obj: unknown, path: string): unknown {
  const [field, rest] = splitPath(path);
  if (obj === null || typeof obj !== "object") return undefined;
  const value = (obj as Record<string, unknown>)[field];
  if (rest === undefined) return value;
  if (value === null || typeof value !== "object") return undefined;
  return (value as Record<string, unknown>)[rest];
}

function compare(actual: unknown, op: ">=" | "<=" | "==", expected: number | string): boolean {
  if (op === "==") return actual === expected;
  if (typeof actual !== "number" || typeof expected !== "number") return false;
  return op === ">=" ? actual >= expected : actual <= expected;
}

function matchesTimeWindow(window: TimeWindow, state: SaveState): boolean {
  const { day, phase, season } = state.clock;
  if (window.phases && !window.phases.includes(phase)) return false;
  if (window.seasons && !window.seasons.includes(season)) return false;
  if (window.minDay !== undefined && day < window.minDay) return false;
  if (window.maxDay !== undefined && day > window.maxDay) return false;
  return true;
}

/** 統一條件求值——所有系統（事件/場景/NPC/任務）都用它決定能不能觸發/顯示。 */
export function evaluateCondition(cond: Condition, state: SaveState): boolean {
  switch (cond.kind) {
    case "always":
      return true;
    case "flag":
      return state.flags.includes(cond.flag) === cond.value;
    case "worldState":
      return compare(getPath(state.worldState, cond.path), cond.op, cond.value);
    case "affinity":
      return (state.affinity[cond.npc] ?? 0) >= cond.value;
    case "stat":
      return state.captainStats[cond.stat] >= cond.value;
    case "reputation":
      return (state.reputation[cond.area] ?? 0) >= cond.value;
    case "exploration":
      return (state.exploration[cond.area] ?? 0) >= cond.value;
    case "eventCompleted":
      return (state.eventHistory[cond.event]?.count ?? 0) > 0;
    case "time":
      return matchesTimeWindow(cond.window, state);
    case "and":
      return cond.all.every((c) => evaluateCondition(c, state));
    case "or":
      return cond.any.some((c) => evaluateCondition(c, state));
    case "not":
      return !evaluateCondition(cond.cond, state);
  }
}
