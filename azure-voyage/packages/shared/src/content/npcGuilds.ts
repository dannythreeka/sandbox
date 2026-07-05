/**
 * 5 個 NPC 商會模板（docs/01 §1）。
 * M1：占位人設（名稱/顏色/性格參數固定值）。M5 由 PERSONA agent 補全 flavorText 等。
 */

export interface NpcGuildTemplate {
  key: string; // 世界內唯一鍵（worldgen 用；DB id 由建檔時產生）
  name: string;
  color: string;
  homeRegionId: string;
  archetype:
    | "DEFENSIVE_TRADER" // 保守重防禦
    | "RAIDER_MERCHANT" // 半商半盜
    | "FINANCIER" // 金融投資型
    | "ROUTE_MONOPOLIST" // 航線壟斷型
    | "EXPLORER_TRADER"; // 探索開拓型
  /** 0–1：風險承受度 / 侵略性（M5 NPC 策略家的輸入） */
  riskTolerance: number;
  aggression: number;
  startingGold: number;
}

export const NPC_GUILD_TEMPLATES: readonly NpcGuildTemplate[] = [
  {
    key: "npc.frost_compact",
    name: "霜港同盟",
    color: "#7fb8d4",
    homeRegionId: "region.north_reach",
    archetype: "DEFENSIVE_TRADER",
    riskTolerance: 0.25,
    aggression: 0.2,
    startingGold: 60000,
  },
  {
    key: "npc.crimson_sails",
    name: "緋帆團",
    color: "#c04a3a",
    homeRegionId: "region.meridian",
    archetype: "RAIDER_MERCHANT",
    riskTolerance: 0.85,
    aggression: 0.8,
    startingGold: 45000,
  },
  {
    key: "npc.gilded_scale",
    name: "鎏金天秤商會",
    color: "#d9a441",
    homeRegionId: "region.amber_gulf",
    archetype: "FINANCIER",
    riskTolerance: 0.45,
    aggression: 0.35,
    startingGold: 90000,
  },
  {
    key: "npc.silkwind_caravan",
    name: "絹風商隊",
    color: "#9a6fc0",
    homeRegionId: "region.silkwind",
    archetype: "ROUTE_MONOPOLIST",
    riskTolerance: 0.5,
    aggression: 0.45,
    startingGold: 70000,
  },
  {
    key: "npc.tideglass_league",
    name: "潮璃聯盟",
    color: "#4ac0a8",
    homeRegionId: "region.coral_arc",
    archetype: "EXPLORER_TRADER",
    riskTolerance: 0.65,
    aggression: 0.3,
    startingGold: 50000,
  },
] as const;
