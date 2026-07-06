/** 發現物（docs/01 §4.6）。座標為 offset（col,row），皆位於外洋/邊陲海域。 */

export const DISCOVERY_CATEGORIES = ["GEOGRAPHY", "BIOLOGY", "RELIC", "CELESTIAL"] as const;
export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_RARITIES = ["C", "B", "A", "S"] as const;
export type DiscoveryRarity = (typeof DISCOVERY_RARITIES)[number];

export interface DiscoveryDef {
  id: string;
  name: string;
  category: DiscoveryCategory;
  rarity: DiscoveryRarity;
  coord: { col: number; row: number };
  /** 探索檢定門檻：航海士 lore 屬性需達到的參考值 */
  requiredLore: number;
  /** 登錄學會可得獎勵 */
  goldReward: number;
  fameReward: number;
}

export const DISCOVERIES: readonly DiscoveryDef[] = [
  { id: "disc.the_glass_reef", name: "琉璃暗礁群", category: "GEOGRAPHY", rarity: "B", coord: { col: 24, row: 60 }, requiredLore: 40, goldReward: 800, fameReward: 5 },
  { id: "disc.singing_current", name: "低吟海流", category: "GEOGRAPHY", rarity: "C", coord: { col: 48, row: 64 }, requiredLore: 25, goldReward: 400, fameReward: 3 },
  { id: "disc.sunken_arch", name: "沉沒的拱門", category: "RELIC", rarity: "A", coord: { col: 10, row: 56 }, requiredLore: 60, goldReward: 2000, fameReward: 12 },
  { id: "disc.driftwood_colony", name: "浮木群島聚落", category: "GEOGRAPHY", rarity: "C", coord: { col: 60, row: 68 }, requiredLore: 20, goldReward: 350, fameReward: 2 },
  { id: "disc.ashen_lighthouse", name: "灰燼燈塔遺跡", category: "RELIC", rarity: "B", coord: { col: 36, row: 68 }, requiredLore: 45, goldReward: 900, fameReward: 6 },
  { id: "disc.pale_leviathan", name: "蒼白巨獸的蹤跡", category: "BIOLOGY", rarity: "A", coord: { col: 38, row: 68 }, requiredLore: 55, goldReward: 1600, fameReward: 10 },
  { id: "disc.mirror_shoal", name: "鏡面魚群", category: "BIOLOGY", rarity: "C", coord: { col: 60, row: 66 }, requiredLore: 22, goldReward: 380, fameReward: 2 },
  { id: "disc.the_still_star", name: "靜止之星觀測點", category: "CELESTIAL", rarity: "S", coord: { col: 48, row: 78 }, requiredLore: 75, goldReward: 4000, fameReward: 25 },
  { id: "disc.amber_current_map", name: "琥珀洋流古圖", category: "RELIC", rarity: "B", coord: { col: 24, row: 70 }, requiredLore: 42, goldReward: 850, fameReward: 5 },
  { id: "disc.whispering_shoals", name: "低語淺灘", category: "GEOGRAPHY", rarity: "C", coord: { col: 70, row: 60 }, requiredLore: 18, goldReward: 300, fameReward: 2 },
  { id: "disc.coral_throne", name: "珊瑚王座", category: "RELIC", rarity: "A", coord: { col: 94, row: 58 }, requiredLore: 58, goldReward: 1800, fameReward: 11 },
  { id: "disc.twin_moon_tide", name: "雙月異潮", category: "CELESTIAL", rarity: "B", coord: { col: 102, row: 62 }, requiredLore: 48, goldReward: 950, fameReward: 6 },
] as const;

export const DISCOVERY_IDS = DISCOVERIES.map((d) => d.id);

export function discoveryById(id: string): DiscoveryDef {
  const discovery = DISCOVERIES.find((d) => d.id === id);
  if (!discovery) throw new Error(`unknown discovery: ${id}`);
  return discovery;
}
