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
  /** 原創歷史氛圍簡介（M26，docs/18），供 UI 顯示 */
  description: string;
}

export const PORTS: readonly PortDef[] = [
  // ── 北環海 ──
  { id: "port.north_reach.frosthaven", name: "霜港", regionId: "region.north_reach", coord: { col: 18, row: 8 }, size: 3, produces: ["com.fish", "com.amber", "com.mead", "com.salt"], description: "北環海的門戶與首府，深水良港終年不凍，全賴洋流眷顧。城牆下的碼頭一年四季燈火不熄，是漁獲、木材與琥珀輸往南方的第一站。" },
  { id: "port.north_reach.valdren", name: "瓦爾德倫", regionId: "region.north_reach", coord: { col: 10, row: 14 }, size: 2, produces: ["com.fur", "com.wool"], description: "建在峽灣深處的獵人聚落，冬季風暴一起便與外界斷了音訊數月。毛皮商隊沿著結冰的河道進城，帶來這座港口賴以維生的皮貨。" },
  // ── 琥珀灣 ──
  { id: "port.amber_gulf.aurelia", name: "奧雷利亞", regionId: "region.amber_gulf", coord: { col: 44, row: 30 }, size: 3, produces: ["com.glasswork", "com.wine", "com.armor"], description: "琥珀灣的心臟，也是蒼瀾海域公認的文明中心。玻璃工坊與釀酒窖鱗次櫛比，各方商會的旗幟在港口廣場上並肩飄揚，是每一位新科船長啟航的起點。" },
  { id: "port.amber_gulf.mirenport", name: "米倫港", regionId: "region.amber_gulf", coord: { col: 36, row: 26 }, size: 2, produces: ["com.olive_oil", "com.artwork", "com.pottery"], description: "以陶匠與畫師聞名的工藝重鎮，狹窄街巷裡藏著幾代人傳下的作坊。橄欖油與彩陶經此裝船，運往整個蒼瀾海域的餐桌與廳堂。" },
  { id: "port.amber_gulf.perlan", name: "佩爾蘭", regionId: "region.amber_gulf", coord: { col: 48, row: 38 }, size: 1, produces: ["com.fish", "com.salt", "com.herbs"], description: "灣區邊緣的小漁村，屋舍沿岩岸層層疊起。這裡沒有商會爭鬥，只有世代討海的家族與曬鹽場上永遠曬不完的鹽。" },
  // ── 鐵崖海岸 ──
  { id: "port.ironcliff.durnhal", name: "杜恩哈", regionId: "region.ironcliff", coord: { col: 12, row: 34 }, size: 3, produces: ["com.iron_ore", "com.weapons", "com.coal"], description: "鐵崖海岸的首府，建在一整片裸露礦脈之上。鍛爐的紅光徹夜不熄，鐵礦與兵刃是這座港口與外界對話的語言。" },
  { id: "port.ironcliff.tarnwick", name: "塔恩維克", regionId: "region.ironcliff", coord: { col: 18, row: 46 }, size: 2, produces: ["com.copper_ore", "com.tools", "com.marble"], description: "銅礦與精工器具的集散地，工匠的鎚聲比市集的叫賣聲更響。這裡出產的每一件工具，都刻著塔恩維克匠人不肯將就的脾氣。" },
  // ── 絹風海峽 ──
  { id: "port.silkwind.serindra", name: "賽琳德拉", regionId: "region.silkwind", coord: { col: 82, row: 24 }, size: 3, produces: ["com.silk", "com.brocade", "com.jade"], description: "絹風海峽的首府，也是連接東西兩端商路的樞紐。關稅官與織品商在同一條街上討價還價，絲綢與翡翠經此流向蒼瀾海域的每一個角落。" },
  { id: "port.silkwind.qeshvar", name: "凱什瓦", regionId: "region.silkwind", coord: { col: 90, row: 30 }, size: 2, produces: ["com.cotton", "com.carpets", "com.tea"], description: "香料與棉紡織品的轉運港，市集終年瀰漫著茶葉與染料的氣味。旅人說，光是走過凱什瓦的市場，就能認全半個海域的商品。" },
  // ── 子午之海 ──
  { id: "port.meridian.zafrahn", name: "薩夫蘭", regionId: "region.meridian", coord: { col: 56, row: 48 }, size: 3, produces: ["com.pepper", "com.cinnamon", "com.sugar"], description: "子午之海的首府，曾是海軍要塞，如今仍能在城牆上看出舊日戰備的痕跡。香料轉運的巨額利潤，與海賊出沒的傳聞，同樣是這座港口的日常。" },
  { id: "port.meridian.bassoro", name: "巴索羅", regionId: "region.meridian", coord: { col: 64, row: 52 }, size: 2, produces: ["com.pepper", "com.ivory", "com.gold_dust", "com.rum"], description: "半是商港、半是避風港的雙面城鎮，據說不少退役的私掠船長都選擇在此終老。酒館裡的故事真假難辨，但陳年的蘭姆酒從不騙人。" },
  // ── 珊瑚環弧 ──
  { id: "port.coral_arc.maruatoll", name: "瑪魯亞環礁", regionId: "region.coral_arc", coord: { col: 92, row: 54 }, size: 2, produces: ["com.pearls", "com.coral", "com.dye"], description: "建在珊瑚環礁上的水上聚落，屋舍以棧橋相連。珍珠與染料是這裡的命脈，潛水人自幼便學會與礁石共處的分寸。" },
  { id: "port.coral_arc.onnesse", name: "歐奈斯", regionId: "region.coral_arc", coord: { col: 86, row: 64 }, size: 1, produces: ["com.coral", "com.fish"], description: "群島邊緣一座樸素的漁港，居民多半靠捕魚與採珠維生。沒有巍峨的建築，只有隨潮汐起落的簡陋碼頭與代代相傳的潛水技藝。" },
  // ── 暮色洋 ──
  { id: "port.dusk.umbralis", name: "昂布拉利斯", regionId: "region.dusk_expanse", coord: { col: 30, row: 66 }, size: 2, produces: ["com.incense", "com.obsidian", "com.salt"], description: "外洋門戶般的港口，繪圖師與探險者常在此補給後再度出航。焚香與黑曜岩是這裡少見的特產，也暗示著更南方尚未標明的海域。" },
  { id: "port.dusk.nyrvana", name: "尼爾瓦納", regionId: "region.dusk_expanse", coord: { col: 54, row: 70 }, size: 1, produces: ["com.incense", "com.herbs"], description: "暮色洋最邊陲的落腳點，人煙稀少，卻常有隱士與觀星者選擇在此定居。夜裡的天色格外清澈，據說是整個蒼瀾海域觀星的絕佳地點。" },
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
