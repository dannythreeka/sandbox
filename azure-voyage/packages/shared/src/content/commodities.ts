/** 36 種交易品、8 分類（docs/01 §4.2）。名稱與分類皆原創。 */

export const COMMODITY_CATEGORIES = [
  "FOOD",
  "DRINK",
  "TEXTILE",
  "ORE",
  "WEAPONRY",
  "CRAFT",
  "LUXURY",
  "SPICE",
] as const;
export type CommodityCategory = (typeof COMMODITY_CATEGORIES)[number];

export interface CommodityDef {
  id: string;
  name: string;
  category: CommodityCategory;
  /** 基礎價（金 = 最小貨幣單位） */
  basePrice: number;
  /** 每單位佔貨艙空間 */
  volume: number;
}

export const COMMODITIES: readonly CommodityDef[] = [
  // FOOD
  { id: "com.fish", name: "魚乾", category: "FOOD", basePrice: 22, volume: 1 },
  { id: "com.salt", name: "海鹽", category: "FOOD", basePrice: 28, volume: 1 },
  { id: "com.olive_oil", name: "橄欖油", category: "FOOD", basePrice: 55, volume: 1 },
  { id: "com.tea", name: "茶葉", category: "FOOD", basePrice: 60, volume: 1 },
  { id: "com.sugar", name: "蔗糖", category: "FOOD", basePrice: 48, volume: 1 },
  // DRINK
  { id: "com.wine", name: "葡萄酒", category: "DRINK", basePrice: 85, volume: 2 },
  { id: "com.rum", name: "蘭姆酒", category: "DRINK", basePrice: 70, volume: 2 },
  { id: "com.mead", name: "蜂蜜酒", category: "DRINK", basePrice: 95, volume: 2 },
  // TEXTILE
  { id: "com.wool", name: "羊毛呢", category: "TEXTILE", basePrice: 80, volume: 2 },
  { id: "com.cotton", name: "棉布", category: "TEXTILE", basePrice: 95, volume: 2 },
  { id: "com.silk", name: "絲綢", category: "TEXTILE", basePrice: 300, volume: 1 },
  { id: "com.brocade", name: "織錦", category: "TEXTILE", basePrice: 380, volume: 1 },
  // ORE
  { id: "com.iron_ore", name: "鐵礦", category: "ORE", basePrice: 35, volume: 3 },
  { id: "com.copper_ore", name: "銅礦", category: "ORE", basePrice: 45, volume: 3 },
  { id: "com.coal", name: "煤炭", category: "ORE", basePrice: 30, volume: 3 },
  { id: "com.marble", name: "大理石", category: "ORE", basePrice: 75, volume: 4 },
  { id: "com.obsidian", name: "黑曜石", category: "ORE", basePrice: 90, volume: 2 },
  // WEAPONRY
  { id: "com.weapons", name: "武具", category: "WEAPONRY", basePrice: 210, volume: 2 },
  { id: "com.armor", name: "甲冑", category: "WEAPONRY", basePrice: 260, volume: 3 },
  { id: "com.tools", name: "工具", category: "WEAPONRY", basePrice: 150, volume: 2 },
  // CRAFT
  { id: "com.glasswork", name: "玻璃工藝", category: "CRAFT", basePrice: 240, volume: 2 },
  { id: "com.artwork", name: "藝品", category: "CRAFT", basePrice: 320, volume: 2 },
  { id: "com.carpets", name: "掛毯", category: "CRAFT", basePrice: 200, volume: 2 },
  { id: "com.pottery", name: "陶器", category: "CRAFT", basePrice: 120, volume: 2 },
  // LUXURY
  { id: "com.amber", name: "琥珀", category: "LUXURY", basePrice: 350, volume: 1 },
  { id: "com.fur", name: "毛皮", category: "LUXURY", basePrice: 280, volume: 2 },
  { id: "com.pearls", name: "珍珠", category: "LUXURY", basePrice: 520, volume: 1 },
  { id: "com.coral", name: "珊瑚", category: "LUXURY", basePrice: 400, volume: 1 },
  { id: "com.jade", name: "翡翠", category: "LUXURY", basePrice: 560, volume: 1 },
  { id: "com.ivory", name: "獸牙", category: "LUXURY", basePrice: 450, volume: 2 },
  { id: "com.gold_dust", name: "砂金", category: "LUXURY", basePrice: 600, volume: 1 },
  // SPICE
  { id: "com.pepper", name: "胡椒", category: "SPICE", basePrice: 320, volume: 1 },
  { id: "com.cinnamon", name: "肉桂", category: "SPICE", basePrice: 280, volume: 1 },
  { id: "com.incense", name: "乳香", category: "SPICE", basePrice: 380, volume: 1 },
  { id: "com.herbs", name: "藥草", category: "SPICE", basePrice: 180, volume: 1 },
  { id: "com.dye", name: "染料", category: "SPICE", basePrice: 220, volume: 1 },
] as const;

export const COMMODITY_IDS = COMMODITIES.map((c) => c.id);

export function commodityById(id: string): CommodityDef {
  const commodity = COMMODITIES.find((c) => c.id === id);
  if (!commodity) throw new Error(`unknown commodity: ${id}`);
  return commodity;
}
