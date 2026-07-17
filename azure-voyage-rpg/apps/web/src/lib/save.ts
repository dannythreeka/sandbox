import type { SaveState } from "@azure-voyage-rpg/engine";

const SAVE_KEY = "azure-voyage-rpg.save.v1";
const SAVE_VERSION = 2;

interface SaveEnvelopeV2 {
  version: 2;
  savedAt: string;
  state: SaveState;
}

export interface LoadSaveResult {
  state: SaveState | null;
  notice: string | null;
  status: "empty" | "ok" | "migrated_v1" | "corrupted_reset" | "incompatible_reset";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSaveState(value: unknown): value is SaveState {
  if (!isRecord(value)) return false;
  if (!isRecord(value.clock)) return false;
  if (typeof value.clock.day !== "number") return false;
  if (typeof value.clock.phase !== "string") return false;
  if (typeof value.clock.season !== "string") return false;
  if (!isStringArray(value.flags)) return false;
  if (!isRecord(value.worldState)) return false;
  if (!isRecord(value.affinity)) return false;
  if (!isRecord(value.reputation)) return false;
  if (!isRecord(value.exploration)) return false;
  if (!isRecord(value.captainStats)) return false;
  if (!isRecord(value.eventHistory)) return false;
  if (!isRecord(value.questProgress)) return false;
  if (!isRecord(value.unlocked)) return false;
  if (!isStringArray(value.unlocked.regions)) return false;
  if (!isStringArray(value.unlocked.areas)) return false;
  if (!isStringArray(value.unlocked.scenes)) return false;
  if (!isStringArray(value.inventory)) return false;
  if (typeof value.playthrough !== "number") return false;
  if (typeof value.currentSceneId !== "string") return false;
  return true;
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false };
    throw error;
  }
}

function wrapV2Envelope(state: SaveState): SaveEnvelopeV2 {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
}

/** SaveState 全部由陣列/物件/純值構成（見 rpg-engine/types.ts），可直接 JSON 化。 */
export function loadSave(): LoadSaveResult {
  if (typeof window === "undefined") return { state: null, notice: null, status: "empty" };
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return { state: null, notice: null, status: "empty" };
  const parsed = parseJson(raw);
  if (!parsed.ok) {
    window.localStorage.removeItem(SAVE_KEY);
    return { state: null, notice: "偵測到損毀存檔，已自動重置為新旅程。", status: "corrupted_reset" };
  }

  const value = parsed.value;
  if (isRecord(value) && value.version === SAVE_VERSION && isSaveState(value.state)) {
    return { state: value.state, notice: null, status: "ok" };
  }

  // v1: 直接存 SaveState，這裡做一次遷移並覆寫成 v2 envelope。
  if (isSaveState(value)) {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(wrapV2Envelope(value)));
    return { state: value, notice: "已自動升級舊版存檔格式。", status: "migrated_v1" };
  }

  window.localStorage.removeItem(SAVE_KEY);
  return { state: null, notice: "存檔格式不相容，已為你建立新的旅程。", status: "incompatible_reset" };
}

export function persistSave(state: SaveState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(wrapV2Envelope(state)));
}

export function clearSave(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SAVE_KEY);
}
