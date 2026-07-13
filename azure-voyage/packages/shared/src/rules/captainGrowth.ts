/**
 * 提督（艦長）個人經驗成長與加成係數（docs/01 附錄；M27，往大航海時代靠近：
 * 玩家角色本人的 RPG 化，區別於 M23 的官員成長——這裡是「你自己」的屬性）。
 * 純函式，供 API 層與測試共用；曲線刻意跟 officerGrowth 對稱但獨立計算。
 */
import { BALANCE } from "../content/constants";

export interface CaptainStats {
  lead: number;
  nav: number;
  combat: number;
  trade: number;
  lore: number;
}

const STAT_KEYS: (keyof CaptainStats)[] = ["lead", "nav", "combat", "trade", "lore"];

export function captainLevel(exp: number): number {
  return Math.floor(Math.max(0, exp) / BALANCE.CAPTAIN_EXP_PER_LEVEL);
}

export interface CaptainExpGainResult {
  exp: number;
  stats: CaptainStats;
  levelsGained: number;
}

/** 獲得經驗值後的新狀態：跨過等級門檻時，全體屬性 +1（上限 100），可能一次連跳多級。 */
export function applyCaptainExpGain(
  currentExp: number,
  gain: number,
  currentStats: CaptainStats,
): CaptainExpGainResult {
  const exp = currentExp + gain;
  const levelsGained = captainLevel(exp) - captainLevel(currentExp);
  if (levelsGained <= 0) return { exp, stats: currentStats, levelsGained: 0 };

  const stats = { ...currentStats };
  for (const key of STAT_KEYS) {
    stats[key] = Math.min(100, stats[key] + levelsGained);
  }
  return { exp, stats, levelsGained };
}

/** 提督航海：艦隊航速加成比例（0–MAX），與航海長職位加成疊加。 */
export function captainNavSpeedBonus(nav: number): number {
  return Math.min(BALANCE.CAPTAIN_NAV_SPEED_BONUS_MAX, nav * BALANCE.CAPTAIN_NAV_SPEED_BONUS_PER_NAV);
}

/** 提督戰鬥：砲擊傷害加成比例（0–MAX），與炮術長職位加成疊加。 */
export function captainCombatDamageBonus(combat: number): number {
  return Math.min(
    BALANCE.CAPTAIN_COMBAT_DAMAGE_BONUS_MAX,
    combat * BALANCE.CAPTAIN_COMBAT_DAMAGE_BONUS_PER_COMBAT,
  );
}

/** 提督商才：買賣折扣加成比例（0–MAX），與會計長職位加成疊加。 */
export function captainTradeBonus(trade: number): number {
  return Math.min(BALANCE.CAPTAIN_TRADE_BONUS_MAX, trade * BALANCE.CAPTAIN_TRADE_BONUS_PER_TRADE);
}

/** 提督學識：風暴／海賊遭遇機率降低比例（0–MAX），與瞭望員職位加成疊加。 */
export function captainDangerReduction(lore: number): number {
  return Math.min(
    BALANCE.CAPTAIN_DANGER_REDUCTION_MAX,
    lore * BALANCE.CAPTAIN_DANGER_REDUCTION_PER_LORE,
  );
}

/** 提督統率：欠薪忠誠度懲罰的減免比例（0–MAX），與副官職位加成疊加。 */
export function captainLoyaltyMitigation(lead: number): number {
  return Math.min(
    BALANCE.CAPTAIN_LEAD_LOYALTY_MITIGATION_MAX,
    lead * BALANCE.CAPTAIN_LEAD_LOYALTY_MITIGATION_PER_LEAD,
  );
}
