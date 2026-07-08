/** 40 港口（docs/01 §1）。座標為 odd-r offset（col,row），地圖 120×80。名稱皆原創。 */

export interface PortDef {
  id: string;
  name: string;
  regionId: string;
  coord: { col: number; row: number };
  /** 規模 1–3：影響市場庫存、設施上限、酒館人選 */
  size: 1 | 2 | 3;
  /** 特產（該港為原產地的商品） */
  produces: string[];
}

export const PORTS: readonly PortDef[] = [
  // ── 北環海 ──
  { id: "port.north_reach.frosthaven", name: "霜港", regionId: "region.north_reach", coord: { col: 18, row: 8 }, size: 3, produces: ["com.fish", "com.amber"] },
  { id: "port.north_reach.seskar", name: "賽斯卡", regionId: "region.north_reach", coord: { col: 30, row: 6 }, size: 1, produces: ["com.fish"] },
  { id: "port.north_reach.valdren", name: "瓦爾德倫", regionId: "region.north_reach", coord: { col: 10, row: 14 }, size: 2, produces: ["com.fur", "com.wool"] },
  { id: "port.north_reach.eldmoor", name: "艾德摩爾", regionId: "region.north_reach", coord: { col: 26, row: 16 }, size: 2, produces: ["com.amber", "com.mead"] },
  { id: "port.north_reach.kolvik", name: "科爾維克", regionId: "region.north_reach", coord: { col: 38, row: 12 }, size: 1, produces: ["com.fish", "com.fur"] },
  { id: "port.north_reach.brumlow", name: "布倫洛", regionId: "region.north_reach", coord: { col: 44, row: 10 }, size: 1, produces: ["com.wool", "com.salt"] },
  // ── 琥珀灣 ──
  { id: "port.amber_gulf.aurelia", name: "奧雷利亞", regionId: "region.amber_gulf", coord: { col: 44, row: 30 }, size: 3, produces: ["com.glasswork", "com.wine"] },
  { id: "port.amber_gulf.mirenport", name: "米倫港", regionId: "region.amber_gulf", coord: { col: 36, row: 26 }, size: 2, produces: ["com.wine", "com.olive_oil"] },
  { id: "port.amber_gulf.castellan", name: "卡斯特蘭", regionId: "region.amber_gulf", coord: { col: 52, row: 28 }, size: 2, produces: ["com.armor", "com.artwork"] },
  { id: "port.amber_gulf.solmere", name: "索爾梅", regionId: "region.amber_gulf", coord: { col: 40, row: 36 }, size: 2, produces: ["com.pottery", "com.herbs"] },
  { id: "port.amber_gulf.perlan", name: "佩爾蘭", regionId: "region.amber_gulf", coord: { col: 48, row: 38 }, size: 1, produces: ["com.fish", "com.salt"] },
  { id: "port.amber_gulf.vireno", name: "維雷諾", regionId: "region.amber_gulf", coord: { col: 58, row: 34 }, size: 1, produces: ["com.olive_oil", "com.artwork"] },
  // ── 鐵崖海岸 ──
  { id: "port.ironcliff.durnhal", name: "杜恩哈", regionId: "region.ironcliff", coord: { col: 12, row: 34 }, size: 3, produces: ["com.iron_ore", "com.weapons"] },
  { id: "port.ironcliff.krag", name: "克拉格", regionId: "region.ironcliff", coord: { col: 8, row: 42 }, size: 1, produces: ["com.iron_ore", "com.coal"] },
  { id: "port.ironcliff.tarnwick", name: "塔恩維克", regionId: "region.ironcliff", coord: { col: 18, row: 46 }, size: 2, produces: ["com.copper_ore", "com.tools"] },
  { id: "port.ironcliff.morvane", name: "莫爾凡", regionId: "region.ironcliff", coord: { col: 14, row: 52 }, size: 2, produces: ["com.weapons", "com.coal"] },
  { id: "port.ironcliff.stonereach", name: "石臂港", regionId: "region.ironcliff", coord: { col: 22, row: 28 }, size: 1, produces: ["com.marble"] },
  { id: "port.ironcliff.gravenholm", name: "格雷文霍姆", regionId: "region.ironcliff", coord: { col: 6, row: 26 }, size: 1, produces: ["com.marble", "com.tools"] },
  // ── 絹風海峽 ──
  { id: "port.silkwind.serindra", name: "賽琳德拉", regionId: "region.silkwind", coord: { col: 82, row: 24 }, size: 3, produces: ["com.silk", "com.brocade"] },
  { id: "port.silkwind.qeshvar", name: "凱什瓦", regionId: "region.silkwind", coord: { col: 90, row: 30 }, size: 2, produces: ["com.cotton", "com.carpets"] },
  { id: "port.silkwind.talomir", name: "塔洛米爾", regionId: "region.silkwind", coord: { col: 78, row: 34 }, size: 2, produces: ["com.silk", "com.tea"] },
  { id: "port.silkwind.venshaal", name: "溫夏爾", regionId: "region.silkwind", coord: { col: 96, row: 22 }, size: 2, produces: ["com.carpets", "com.jade"] },
  { id: "port.silkwind.ilkoro", name: "伊爾科羅", regionId: "region.silkwind", coord: { col: 86, row: 38 }, size: 1, produces: ["com.cotton", "com.tea"] },
  { id: "port.silkwind.mashqet", name: "瑪什凱", regionId: "region.silkwind", coord: { col: 102, row: 34 }, size: 1, produces: ["com.jade", "com.brocade"] },
  // ── 子午之海 ──
  { id: "port.meridian.zafrahn", name: "薩夫蘭", regionId: "region.meridian", coord: { col: 56, row: 48 }, size: 3, produces: ["com.pepper", "com.cinnamon"] },
  { id: "port.meridian.bassoro", name: "巴索羅", regionId: "region.meridian", coord: { col: 64, row: 52 }, size: 2, produces: ["com.pepper", "com.ivory"] },
  { id: "port.meridian.calverre", name: "卡爾維爾", regionId: "region.meridian", coord: { col: 48, row: 54 }, size: 2, produces: ["com.sugar", "com.rum"] },
  { id: "port.meridian.okoro", name: "奧科羅", regionId: "region.meridian", coord: { col: 70, row: 46 }, size: 1, produces: ["com.ivory", "com.gold_dust"] },
  { id: "port.meridian.sirmarsh", name: "席爾沼港", regionId: "region.meridian", coord: { col: 44, row: 60 }, size: 1, produces: ["com.herbs", "com.rum"] },
  { id: "port.meridian.tallowine", name: "塔洛溫", regionId: "region.meridian", coord: { col: 60, row: 58 }, size: 1, produces: ["com.cinnamon", "com.sugar"] },
  // ── 珊瑚環弧 ──
  { id: "port.coral_arc.maruatoll", name: "瑪魯亞環礁", regionId: "region.coral_arc", coord: { col: 92, row: 54 }, size: 2, produces: ["com.pearls", "com.coral"] },
  { id: "port.coral_arc.telivai", name: "特利瓦伊", regionId: "region.coral_arc", coord: { col: 100, row: 60 }, size: 2, produces: ["com.pearls", "com.dye"] },
  { id: "port.coral_arc.onnesse", name: "歐奈斯", regionId: "region.coral_arc", coord: { col: 86, row: 64 }, size: 1, produces: ["com.coral", "com.fish"] },
  { id: "port.coral_arc.kavalu", name: "卡瓦魯", regionId: "region.coral_arc", coord: { col: 106, row: 52 }, size: 1, produces: ["com.dye", "com.sugar"] },
  { id: "port.coral_arc.ravashell", name: "拉瓦貝港", regionId: "region.coral_arc", coord: { col: 96, row: 68 }, size: 1, produces: ["com.pearls", "com.coral"] },
  // ── 暮色洋 ──
  { id: "port.dusk.umbralis", name: "昂布拉利斯", regionId: "region.dusk_expanse", coord: { col: 30, row: 66 }, size: 2, produces: ["com.incense", "com.obsidian"] },
  { id: "port.dusk.nyrvana", name: "尼爾瓦納", regionId: "region.dusk_expanse", coord: { col: 54, row: 70 }, size: 1, produces: ["com.incense", "com.herbs"] },
  { id: "port.dusk.veymar", name: "維馬爾", regionId: "region.dusk_expanse", coord: { col: 16, row: 62 }, size: 1, produces: ["com.obsidian", "com.salt"] },
  { id: "port.dusk.sunkenreach", name: "沉沒之臂", regionId: "region.dusk_expanse", coord: { col: 66, row: 74 }, size: 1, produces: ["com.salt", "com.obsidian"] },
  { id: "port.dusk.ashfall", name: "燼落港", regionId: "region.dusk_expanse", coord: { col: 42, row: 74 }, size: 1, produces: ["com.obsidian", "com.incense"] },
] as const;

export const PORT_IDS = PORTS.map((p) => p.id);

export function portById(id: string): PortDef {
  const port = PORTS.find((p) => p.id === id);
  if (!port) throw new Error(`unknown port: ${id}`);
  return port;
}

/** 以座標反查港口（自由航行點到港口格時視同指定該港為目的地） */
export function portAtCoord(coord: { col: number; row: number }): PortDef | undefined {
  return PORTS.find((p) => p.coord.col === coord.col && p.coord.row === coord.row);
}

/** 玩家起始港（琥珀灣首都） */
export const HOME_PORT_ID = "port.amber_gulf.aurelia";
