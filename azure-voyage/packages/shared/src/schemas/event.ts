import { z } from "zod";

export const WORLD_EVENT_TYPES = ["STORM", "FESTIVAL", "RUMOR"] as const;
export const WorldEventTypeSchema = z.enum(WORLD_EVENT_TYPES);

export const WorldEventViewSchema = z.object({
  id: z.string(),
  type: WorldEventTypeSchema,
  narrative: z.string(),
  portId: z.string().optional(),
});
export type WorldEventView = z.infer<typeof WorldEventViewSchema>;

export const ServerEventSchema = z.object({
  tick: z.number().int().nonnegative(),
  fleetId: z.string().optional(),
  event: WorldEventViewSchema,
});
export type ServerEventPayload = z.infer<typeof ServerEventSchema>;

// ── 探索 ──

export const ExploreInputSchema = z.object({
  discoveryId: z.string().optional(), // 未指定時由伺服器依當前座標查找最近未探索點
});
export type ExploreInput = z.infer<typeof ExploreInputSchema>;

export const ExploreResultSchema = z.object({
  success: z.boolean(),
  discoveryId: z.string().optional(),
  name: z.string().optional(),
  narrative: z.string(),
});
export type ExploreResult = z.infer<typeof ExploreResultSchema>;

export const DiscoveryRecordViewSchema = z.object({
  id: z.string(),
  discoveryId: z.string(),
  name: z.string(),
  category: z.string(),
  rarity: z.string(),
  registered: z.boolean(),
  goldReward: z.number().int(),
  fameReward: z.number().int(),
  /** AI 生成（或 fallback）的圖鑑敘事，找到時固化一次；尚未固化前為 undefined。 */
  narrative: z.string().optional(),
});
export type DiscoveryRecordView = z.infer<typeof DiscoveryRecordViewSchema>;

// ── 圖鑑（Codex，M22）：完整發現物清單，未找到的以剪影呈現 ──

export const DiscoveryCodexEntrySchema = z.object({
  discoveryId: z.string(),
  category: z.string(),
  rarity: z.string(),
  found: z.boolean(),
  registered: z.boolean(),
  /** 未找到時為 undefined，前端顯示為剪影／「???」 */
  name: z.string().optional(),
  description: z.string().optional(),
  narrative: z.string().optional(),
  goldReward: z.number().int().optional(),
  fameReward: z.number().int().optional(),
});
export type DiscoveryCodexEntry = z.infer<typeof DiscoveryCodexEntrySchema>;

export const RegisterDiscoveryInputSchema = z.object({
  discoveryRecordId: z.string().min(1),
});
export type RegisterDiscoveryInput = z.infer<typeof RegisterDiscoveryInputSchema>;

export const RegisterDiscoveryResultSchema = z.object({
  goldReward: z.number().int(),
  fameReward: z.number().int(),
});
export type RegisterDiscoveryResult = z.infer<typeof RegisterDiscoveryResultSchema>;
