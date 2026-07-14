import { GAME_PHASES, type Effect, type GameClock, type SaveState } from "./types";

/** worldState 路徑最多兩層，見 condition.ts 的同名說明——鍵本身可能含點。 */
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

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const [field, rest] = splitPath(path);
  if (rest === undefined) {
    obj[field] = value;
    return;
  }
  if (typeof obj[field] !== "object" || obj[field] === null) obj[field] = {};
  (obj[field] as Record<string, unknown>)[rest] = value;
}

/** 推進時段：DAWN→DAY→DUSK→NIGHT→隔天 DAWN。 */
export function advanceClock(clock: GameClock, steps: number): GameClock {
  let phaseIndex = GAME_PHASES.indexOf(clock.phase);
  let day = clock.day;
  for (let i = 0; i < steps; i++) {
    phaseIndex += 1;
    if (phaseIndex >= GAME_PHASES.length) {
      phaseIndex = 0;
      day += 1;
    }
  }
  return { ...clock, day, phase: GAME_PHASES[phaseIndex] };
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

/** 統一後果套用——事件/任務獎勵都用它改變存檔狀態。回傳新的 SaveState（不修改輸入）。 */
export function applyEffect(effect: Effect, state: SaveState): SaveState {
  const next: SaveState = {
    ...state,
    flags: [...state.flags],
    worldState: JSON.parse(JSON.stringify(state.worldState)),
    affinity: { ...state.affinity },
    reputation: { ...state.reputation },
    exploration: { ...state.exploration },
    inventory: [...state.inventory],
    unlocked: {
      regions: [...state.unlocked.regions],
      areas: [...state.unlocked.areas],
      scenes: [...state.unlocked.scenes],
    },
  };

  for (const flag of effect.setFlags ?? []) {
    if (!next.flags.includes(flag)) next.flags.push(flag);
  }

  for (const w of effect.worldState ?? []) {
    if (w.set !== undefined) {
      setPath(next.worldState as unknown as Record<string, unknown>, w.path, w.set);
    } else {
      const current = getPath(next.worldState, w.path);
      const base = typeof current === "number" ? current : 0;
      setPath(next.worldState as unknown as Record<string, unknown>, w.path, base + (w.delta ?? 0));
    }
  }

  for (const a of effect.affinity ?? []) {
    next.affinity[a.npc] = (next.affinity[a.npc] ?? 0) + a.delta;
  }

  for (const r of effect.reputation ?? []) {
    next.reputation[r.area] = (next.reputation[r.area] ?? 0) + r.delta;
  }

  if (effect.unlock?.regions) next.unlocked.regions = unique([...next.unlocked.regions, ...effect.unlock.regions]);
  if (effect.unlock?.areas) next.unlocked.areas = unique([...next.unlocked.areas, ...effect.unlock.areas]);
  if (effect.unlock?.scenes) next.unlocked.scenes = unique([...next.unlocked.scenes, ...effect.unlock.scenes]);

  if (effect.advanceTime) next.clock = advanceClock(next.clock, effect.advanceTime);

  if (effect.giveItem) next.inventory.push(...effect.giveItem);

  return next;
}
