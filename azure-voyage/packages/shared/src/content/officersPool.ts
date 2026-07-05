/**
 * 航海士生成模板（docs/03 §4）。名字全部原創。
 * worldgen 以世界 seed 決定實際屬性（在 range 內擲骰）與出場順序。
 */

export const OFFICER_ROLES = [
  "FIRST_MATE",
  "NAVIGATOR",
  "GUNNER",
  "PURSER",
  "LOOKOUT",
] as const;
export type OfficerRole = (typeof OFFICER_ROLES)[number];

export const SKILL_TAGS = [
  "skill.cartography", // 測繪
  "skill.gunnery", // 炮術
  "skill.negotiation", // 談判
  "skill.languages", // 外語
  "skill.provisioning", // 補給管理
  "skill.swordplay", // 劍術
  "skill.astronomy", // 觀星
  "skill.accounting", // 簿記
  "skill.carpentry", // 船匠
  "skill.leadership", // 統御
  "skill.scouting", // 斥候
  "skill.medicine", // 醫術
] as const;
export type SkillTag = (typeof SKILL_TAGS)[number];

export interface OfficerStats {
  lead: number;
  nav: number;
  combat: number;
  trade: number;
  lore: number;
}

export interface OfficerTemplate {
  key: string;
  name: string;
  portrait: string; // 資產 key（M6 美術）
  /** 屬性範圍 [min,max]；worldgen 擲骰 */
  statRanges: Record<keyof OfficerStats, [number, number]>;
  skills: SkillTag[];
  salary: number;
  /** 出現條件：港口規模下限（酒館池用，M4） */
  minPortSize: 1 | 2 | 3;
}

export const OFFICER_TEMPLATES: readonly OfficerTemplate[] = [
  { key: "off.sera_vandel", name: "賽菈・凡德", portrait: "portrait.sera", statRanges: { lead: [40, 55], nav: [60, 75], combat: [25, 40], trade: [35, 50], lore: [55, 70] }, skills: ["skill.cartography", "skill.astronomy"], salary: 120, minPortSize: 1 },
  { key: "off.bram_holt", name: "布拉姆・霍特", portrait: "portrait.bram", statRanges: { lead: [50, 65], nav: [35, 50], combat: [55, 70], trade: [20, 35], lore: [25, 40] }, skills: ["skill.gunnery", "skill.leadership"], salary: 140, minPortSize: 1 },
  { key: "off.nerissa_kaine", name: "涅莉莎・凱恩", portrait: "portrait.nerissa", statRanges: { lead: [30, 45], nav: [40, 55], combat: [30, 45], trade: [60, 78], lore: [45, 60] }, skills: ["skill.accounting", "skill.negotiation"], salary: 130, minPortSize: 1 },
  { key: "off.tovan_reeve", name: "托凡・里夫", portrait: "portrait.tovan", statRanges: { lead: [35, 50], nav: [55, 70], combat: [40, 55], trade: [25, 40], lore: [35, 50] }, skills: ["skill.scouting", "skill.provisioning"], salary: 110, minPortSize: 1 },
  { key: "off.ismay_qorel", name: "伊絲梅・柯瑞", portrait: "portrait.ismay", statRanges: { lead: [45, 60], nav: [30, 45], combat: [20, 35], trade: [55, 70], lore: [60, 75] }, skills: ["skill.languages", "skill.negotiation"], salary: 150, minPortSize: 2 },
  { key: "off.darrok_venn", name: "達洛克・凡恩", portrait: "portrait.darrok", statRanges: { lead: [55, 70], nav: [40, 55], combat: [65, 80], trade: [15, 30], lore: [20, 35] }, skills: ["skill.swordplay", "skill.gunnery"], salary: 170, minPortSize: 2 },
  { key: "off.lyra_moss", name: "萊拉・莫絲", portrait: "portrait.lyra", statRanges: { lead: [25, 40], nav: [45, 60], combat: [25, 40], trade: [40, 55], lore: [65, 80] }, skills: ["skill.medicine", "skill.astronomy"], salary: 135, minPortSize: 2 },
  { key: "off.garvin_ash", name: "加爾文・艾許", portrait: "portrait.garvin", statRanges: { lead: [40, 55], nav: [50, 65], combat: [45, 60], trade: [30, 45], lore: [30, 45] }, skills: ["skill.carpentry", "skill.provisioning"], salary: 125, minPortSize: 1 },
  { key: "off.ophira_senn", name: "歐菲拉・森恩", portrait: "portrait.ophira", statRanges: { lead: [60, 75], nav: [45, 60], combat: [50, 65], trade: [35, 50], lore: [40, 55] }, skills: ["skill.leadership", "skill.negotiation"], salary: 200, minPortSize: 3 },
  { key: "off.kesh_madrun", name: "凱許・瑪德倫", portrait: "portrait.kesh", statRanges: { lead: [30, 45], nav: [65, 80], combat: [35, 50], trade: [25, 40], lore: [50, 65] }, skills: ["skill.cartography", "skill.scouting"], salary: 160, minPortSize: 2 },
  { key: "off.fenna_dole", name: "芬娜・多爾", portrait: "portrait.fenna", statRanges: { lead: [35, 50], nav: [30, 45], combat: [30, 45], trade: [65, 80], lore: [45, 60] }, skills: ["skill.accounting", "skill.languages"], salary: 155, minPortSize: 2 },
  { key: "off.rudger_thane", name: "魯格・賽恩", portrait: "portrait.rudger", statRanges: { lead: [45, 60], nav: [35, 50], combat: [60, 75], trade: [20, 35], lore: [25, 40] }, skills: ["skill.swordplay", "skill.leadership"], salary: 165, minPortSize: 2 },
] as const;

/** 新開局的 2 名起始夥伴（固定前兩位模板，屬性仍由 seed 擲骰） */
export const STARTING_OFFICER_KEYS = ["off.sera_vandel", "off.bram_holt"] as const;
