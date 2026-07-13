/**
 * 港口人物（docs/17，M25）。每個港口配一位原創人物，名字與角色原型全部原創，
 * 不對應任何現實或既有作品人物。世界建立時依此清單建立佔位資料，
 * 人設文字（description/greeting）由 PersonaService 事後補全（同 NPC 商會/航海士模式）。
 */

export const PORT_NOTABLE_ARCHETYPES = [
  "HARBORMASTER", // 港務總管：主要海域首都港，執掌港務與稅收
  "FUR_TRADER", // 毛皮商
  "GUILD_ELDER", // 工藝商會元老
  "OLD_FISHERMAN", // 老漁夫
  "BLACKSMITH", // 鐵匠工頭
  "SILK_MERCHANT", // 絲織商人
  "RETIRED_PRIVATEER", // 退役私掠船長
  "PEARL_MERCHANT", // 珍珠商
  "DIVER_ELDER", // 潛水人長老
  "CARTOGRAPHER", // 製圖師
  "HERMIT_ASTRONOMER", // 隱居占星師
] as const;
export type PortNotableArchetype = (typeof PORT_NOTABLE_ARCHETYPES)[number];

export interface PortNotableTemplate {
  portId: string;
  name: string;
  portrait: string;
  archetype: PortNotableArchetype;
}

export const PORT_NOTABLE_TEMPLATES: readonly PortNotableTemplate[] = [
  { portId: "port.north_reach.frosthaven", name: "霍爾格・斯托姆維克", portrait: "portrait.notable_frosthaven", archetype: "HARBORMASTER" },
  { portId: "port.north_reach.valdren", name: "艾莎・佛斯特", portrait: "portrait.notable_valdren", archetype: "FUR_TRADER" },
  { portId: "port.amber_gulf.aurelia", name: "馬瑟斯・凡登霍夫", portrait: "portrait.notable_aurelia", archetype: "HARBORMASTER" },
  { portId: "port.amber_gulf.mirenport", name: "莉薇亞・卡珊卓", portrait: "portrait.notable_mirenport", archetype: "GUILD_ELDER" },
  { portId: "port.amber_gulf.perlan", name: "圖克・佩蘭", portrait: "portrait.notable_perlan", archetype: "OLD_FISHERMAN" },
  { portId: "port.ironcliff.durnhal", name: "布倫・鐵鎚", portrait: "portrait.notable_durnhal", archetype: "HARBORMASTER" },
  { portId: "port.ironcliff.tarnwick", name: "葛麗塔・鑄爐", portrait: "portrait.notable_tarnwick", archetype: "BLACKSMITH" },
  { portId: "port.silkwind.serindra", name: "札辛・阿爾曼德", portrait: "portrait.notable_serindra", archetype: "HARBORMASTER" },
  { portId: "port.silkwind.qeshvar", name: "蕾希瑪・沃恩", portrait: "portrait.notable_qeshvar", archetype: "SILK_MERCHANT" },
  { portId: "port.meridian.zafrahn", name: "達里歐・凡赫辛", portrait: "portrait.notable_zafrahn", archetype: "HARBORMASTER" },
  { portId: "port.meridian.bassoro", name: "柯爾・巴索", portrait: "portrait.notable_bassoro", archetype: "RETIRED_PRIVATEER" },
  { portId: "port.coral_arc.maruatoll", name: "娜蒂雅・珊瑚心", portrait: "portrait.notable_maruatoll", archetype: "PEARL_MERCHANT" },
  { portId: "port.coral_arc.onnesse", name: "奧希・凡塔", portrait: "portrait.notable_onnesse", archetype: "DIVER_ELDER" },
  { portId: "port.dusk.umbralis", name: "賽菈斐娜・墨影", portrait: "portrait.notable_umbralis", archetype: "CARTOGRAPHER" },
  { portId: "port.dusk.nyrvana", name: "奧丁・夜語", portrait: "portrait.notable_nyrvana", archetype: "HERMIT_ASTRONOMER" },
] as const;

export function portNotableTemplateForPort(portId: string): PortNotableTemplate {
  const template = PORT_NOTABLE_TEMPLATES.find((t) => t.portId === portId);
  if (!template) throw new Error(`no port notable template for port: ${portId}`);
  return template;
}
