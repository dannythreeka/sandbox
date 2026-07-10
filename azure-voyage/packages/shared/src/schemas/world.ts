import { z } from "zod";

export const DIFFICULTIES = ["EASY", "NORMAL", "HARD"] as const;
export const DifficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const WORLD_STATUSES = ["ACTIVE", "VICTORY", "DEFEAT", "ABANDONED"] as const;
export const WorldStatusSchema = z.enum(WORLD_STATUSES);
export type WorldStatus = z.infer<typeof WorldStatusSchema>;

export const CreateWorldInputSchema = z.object({
  name: z.string().min(1).max(30),
  difficulty: DifficultySchema,
});
export type CreateWorldInput = z.infer<typeof CreateWorldInputSchema>;

export const WorldSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  difficulty: DifficultySchema,
  status: WorldStatusSchema,
  currentTick: z.number().int().nonnegative(),
  contentVersion: z.string(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(),
});
export type WorldSummary = z.infer<typeof WorldSummarySchema>;

// ── 世界快照（docs/04 §8）。M1 版本：完整初始狀態；activeEvents 於 M2+ 填充 ──

/** M19 PERSONA agent 補全前為 undefined；補全後才有真人設可顯示/對話。 */
export const PersonaGenViewSchema = z.object({
  description: z.string(),
  greeting: z.string(),
});
export type PersonaGenView = z.infer<typeof PersonaGenViewSchema>;

export const OfficerViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  portrait: z.string(),
  role: z.string().nullable(),
  stats: z.object({
    lead: z.number().int(),
    nav: z.number().int(),
    combat: z.number().int(),
    trade: z.number().int(),
    lore: z.number().int(),
  }),
  skills: z.array(z.string()),
  loyalty: z.number().int(),
  salary: z.number().int(),
  persona: PersonaGenViewSchema.optional(),
});
export type OfficerView = z.infer<typeof OfficerViewSchema>;

export const ShipViewSchema = z.object({
  id: z.string(),
  shipClassId: z.string(),
  name: z.string(),
  hull: z.number().int(),
  sails: z.number().int(),
  crew: z.number().int(),
  isFlagship: z.boolean(),
  cargo: z.array(
    z.object({
      commodityId: z.string(),
      quantity: z.number().int().positive(),
      avgBuyPrice: z.number().int(),
    }),
  ),
});
export type ShipView = z.infer<typeof ShipViewSchema>;

export const FleetViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  activity: z.enum(["DOCKED", "SAILING", "ANCHORED", "EXPLORING", "IN_BATTLE"]),
  pos: z.object({ q: z.number().int(), r: z.number().int() }),
  dockedPortId: z.string().nullable(),
  food: z.number().int(),
  water: z.number().int(),
  morale: z.number().int(),
  ships: z.array(ShipViewSchema),
  officers: z.array(OfficerViewSchema),
});
export type FleetView = z.infer<typeof FleetViewSchema>;

export const PortSummarySchema = z.object({
  portId: z.string(),
  name: z.string(),
  regionId: z.string(),
  coord: z.object({ col: z.number().int(), row: z.number().int() }),
  size: z.number().int().min(1).max(3),
  /** 是否到訪過（迷霧；M1 僅起始港為 true，M2 隨航行更新） */
  visited: z.boolean(),
});
export type PortSummary = z.infer<typeof PortSummarySchema>;

export const NpcGuildPublicViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  fame: z.number().int(),
  persona: PersonaGenViewSchema.optional(),
});
export type NpcGuildPublicView = z.infer<typeof NpcGuildPublicViewSchema>;

export const WorldSnapshotSchema = z.object({
  world: WorldSummarySchema.extend({ seed: z.number().int() }),
  playerGuild: z.object({
    id: z.string(),
    name: z.string(),
    gold: z.number().int(), // 金額整數；API 層以 number 傳輸（< 2^53 安全）
    fame: z.number().int(),
  }),
  fleets: z.array(FleetViewSchema),
  knownPorts: z.array(PortSummarySchema),
  npcGuilds: z.array(NpcGuildPublicViewSchema),
  victoryProgress: z.object({
    regionsDominated: z.number().int(),
    relicsFound: z.number().int(),
    totalAssets: z.number().int(),
  }),
});
export type WorldSnapshot = z.infer<typeof WorldSnapshotSchema>;
