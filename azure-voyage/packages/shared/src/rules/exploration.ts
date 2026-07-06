/** 探索檢定（docs/01 §4.6）。純函式：成功機率由學識屬性與發現物門檻決定。 */

/** 學識超過門檻越多，成功率越高；門檻以下仍有基礎機率，滿級穩過。 */
export function explorationSuccessChance(loreStat: number, requiredLore: number): number {
  const margin = loreStat - requiredLore;
  const chance = 0.35 + margin * 0.012;
  return Math.min(0.95, Math.max(0.05, chance));
}
