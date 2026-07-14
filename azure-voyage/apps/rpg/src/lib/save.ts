import type { SaveState } from "@azure-voyage/rpg-engine";

const SAVE_KEY = "azure-voyage-rpg.save.v1";

/** SaveState 全部由陣列/物件/純值構成（見 rpg-engine/types.ts），可直接 JSON 化。 */
export function loadSave(): SaveState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaveState;
  } catch {
    return null;
  }
}

export function persistSave(state: SaveState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearSave(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SAVE_KEY);
}
