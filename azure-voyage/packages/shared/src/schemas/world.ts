import { z } from "zod";

export const DIFFICULTIES = ["EASY", "NORMAL", "HARD"] as const;
export const DifficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const WORLD_STATUSES = ["ACTIVE", "VICTORY", "DEFEAT", "ABANDONED"] as const;
export const WorldStatusSchema = z.enum(WORLD_STATUSES);
export type WorldStatus = z.infer<typeof WorldStatusSchema>;

/** 每帳號存檔上限（M0 平衡常數的先行者；正式常數表在 M1 的 content/constants.ts） */
export const MAX_ACTIVE_WORLDS_PER_USER = 5;

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

/**
 * M0 的世界快照：只有 world 區塊。
 * M1 起依 04-api-design.md §8 擴充（playerGuild / fleets / knownPorts / ...）。
 */
export const WorldSnapshotSchema = z.object({
  world: WorldSummarySchema.extend({ seed: z.number().int() }),
});
export type WorldSnapshot = z.infer<typeof WorldSnapshotSchema>;
