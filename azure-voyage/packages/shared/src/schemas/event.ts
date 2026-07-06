import { z } from "zod";

export const WORLD_EVENT_TYPES = ["STORM", "FESTIVAL"] as const;
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
});
export type DiscoveryRecordView = z.infer<typeof DiscoveryRecordViewSchema>;

export const RegisterDiscoveryInputSchema = z.object({
  discoveryRecordId: z.string().min(1),
});
export type RegisterDiscoveryInput = z.infer<typeof RegisterDiscoveryInputSchema>;

export const RegisterDiscoveryResultSchema = z.object({
  goldReward: z.number().int(),
  fameReward: z.number().int(),
});
export type RegisterDiscoveryResult = z.infer<typeof RegisterDiscoveryResultSchema>;
