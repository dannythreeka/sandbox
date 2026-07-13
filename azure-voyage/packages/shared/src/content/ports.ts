/**
 * 15 港口（docs/01 §1；原 40 港精選縮編，理由見 docs/12 §1）。
 * 座標為 odd-r offset（col,row），地圖 120×80。名稱皆原創。
 * produces 已合併被刪港口的特產，全 36 種商品仍各至少有一個產地。
 */

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
  { id: "port.north_reach.frosthaven", name: "霜港", regionId: "region.north_reach", coord: { col: 18, row: 8 }, size: 3, produces: ["com.fish", "com.amber", "com.mead", "com.salt"] },
  { id: "port.north_reach.valdren", name: "瓦爾德倫", regionId: "region.north_reach", coord: { col: 10, row: 14 }, size: 2, produces: ["com.fur", "com.wool"] },
  // ── 琥珀灣 ──
  { id: "port.amber_gulf.aurelia", name: "奧雷利亞", regionId: "region.amber_gulf", coord: { col: 44, row: 30 }, size: 3, produces: ["com.glasswork", "com.wine", "com.armor"] },
  { id: "port.amber_gulf.mirenport", name: "米倫港", regionId: "region.amber_gulf", coord: { col: 36, row: 26 }, size: 2, produces: ["com.olive_oil", "com.artwork", "com.pottery"] },
  { id: "port.amber_gulf.perlan", name: "佩爾蘭", regionId: "region.amber_gulf", coord: { col: 48, row: 38 }, size: 1, produces: ["com.fish", "com.salt", "com.herbs"] },
  // ── 鐵崖海岸 ──
  { id: "port.ironcliff.durnhal", name: "杜恩哈", regionId: "region.ironcliff", coord: { col: 12, row: 34 }, size: 3, produces: ["com.iron_ore", "com.weapons", "com.coal"] },
  { id: "port.ironcliff.tarnwick", name: "塔恩維克", regionId: "region.ironcliff", coord: { col: 18, row: 46 }, size: 2, produces: ["com.copper_ore", "com.tools", "com.marble"] },
  // ── 絹風海峽 ──
  { id: "port.silkwind.serindra", name: "賽琳德拉", regionId: "region.silkwind", coord: { col: 82, row: 24 }, size: 3, produces: ["com.silk", "com.brocade", "com.jade"] },
  { id: "port.silkwind.qeshvar", name: "凱什瓦", regionId: "region.silkwind", coord: { col: 90, row: 30 }, size: 2, produces: ["com.cotton", "com.carpets", "com.tea"] },
  // ── 子午之海 ──
  { id: "port.meridian.zafrahn", name: "薩夫蘭", regionId: "region.meridian", coord: { col: 56, row: 48 }, size: 3, produces: ["com.pepper", "com.cinnamon", "com.sugar"] },
  { id: "port.meridian.bassoro", name: "巴索羅", regionId: "region.meridian", coord: { col: 64, row: 52 }, size: 2, produces: ["com.pepper", "com.ivory", "com.gold_dust", "com.rum"] },
  // ── 珊瑚環弧 ──
  { id: "port.coral_arc.maruatoll", name: "瑪魯亞環礁", regionId: "region.coral_arc", coord: { col: 92, row: 54 }, size: 2, produces: ["com.pearls", "com.coral", "com.dye"] },
  { id: "port.coral_arc.onnesse", name: "歐奈斯", regionId: "region.coral_arc", coord: { col: 86, row: 64 }, size: 1, produces: ["com.coral", "com.fish"] },
  // ── 暮色洋 ──
  { id: "port.dusk.umbralis", name: "昂布拉利斯", regionId: "region.dusk_expanse", coord: { col: 30, row: 66 }, size: 2, produces: ["com.incense", "com.obsidian", "com.salt"] },
  { id: "port.dusk.nyrvana", name: "尼爾瓦納", regionId: "region.dusk_expanse", coord: { col: 54, row: 70 }, size: 1, produces: ["com.incense", "com.herbs"] },
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

/**
 * M21 縮編（40→15）刪除的港口 id → 目前最近的存續港口（依 hex 距離挑選，見 docs/13）。
 * 供既有存檔資料自我修復：艦隊/航海士若還停在已刪除的港口，改停到最近的存續港，
 * 而不是讓 portById() 對這些舊 id 丟例外。
 */
export const REMOVED_PORT_REPLACEMENTS: Record<string, string> = {
  "port.north_reach.seskar": "port.north_reach.frosthaven",
  "port.north_reach.eldmoor": "port.north_reach.frosthaven",
  "port.north_reach.kolvik": "port.north_reach.frosthaven",
  "port.north_reach.brumlow": "port.north_reach.frosthaven",
  "port.amber_gulf.castellan": "port.amber_gulf.aurelia",
  "port.amber_gulf.solmere": "port.amber_gulf.aurelia",
  "port.amber_gulf.vireno": "port.amber_gulf.perlan",
  "port.ironcliff.krag": "port.ironcliff.durnhal",
  "port.ironcliff.morvane": "port.ironcliff.tarnwick",
  "port.ironcliff.stonereach": "port.ironcliff.durnhal",
  "port.ironcliff.gravenholm": "port.ironcliff.durnhal",
  "port.silkwind.talomir": "port.silkwind.serindra",
  "port.silkwind.venshaal": "port.silkwind.qeshvar",
  "port.silkwind.ilkoro": "port.silkwind.qeshvar",
  "port.silkwind.mashqet": "port.silkwind.qeshvar",
  "port.meridian.calverre": "port.meridian.zafrahn",
  "port.meridian.okoro": "port.meridian.bassoro",
  "port.meridian.sirmarsh": "port.meridian.zafrahn",
  "port.meridian.tallowine": "port.meridian.bassoro",
  "port.coral_arc.telivai": "port.coral_arc.maruatoll",
  "port.coral_arc.kavalu": "port.coral_arc.maruatoll",
  "port.coral_arc.ravashell": "port.coral_arc.onnesse",
  "port.dusk.veymar": "port.dusk.umbralis",
  "port.dusk.sunkenreach": "port.dusk.nyrvana",
  "port.dusk.ashfall": "port.dusk.nyrvana",
};

/** 存續港口 id 原樣傳回；已刪除的舊 id 傳回替代港口 id；都不是則退回首都港。 */
export function resolvePortId(id: string): string {
  if (PORTS.some((p) => p.id === id)) return id;
  return REMOVED_PORT_REPLACEMENTS[id] ?? HOME_PORT_ID;
}

/** 對既有存檔資料友善版的 portById：已刪除的舊港口 id 會回退到最近的存續港口，而非丟例外。 */
export function portByIdOrFallback(id: string): PortDef {
  return portById(resolvePortId(id));
}
