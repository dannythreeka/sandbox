import { z } from "zod";
import { WorldSnapshotSchema, WorldStatusSchema } from "./world";

/** Socket.IO 事件名常數（前後端唯一來源，禁止手打字串） */
export const WS_EVENTS = {
  // client → server
  CLIENT_JOIN: "client:join",
  CLIENT_RESYNC: "client:resync",
  CLIENT_ADVANCE: "client:advance",
  CLIENT_STEER: "client:steer",
  BATTLE_ACTION: "battle:action",
  // server → client
  SERVER_JOINED: "server:joined",
  SERVER_RESYNC: "server:resync",
  SERVER_ERROR: "server:error",
  SERVER_TICK: "server:tick",
  SERVER_ARRIVAL: "server:arrival",
  SERVER_EVENT: "server:event",
  SERVER_BATTLE_START: "server:battle-start",
  BATTLE_UPDATE: "battle:update",
  BATTLE_END: "battle:end",
  SERVER_VICTORY: "server:victory",
  SERVER_QUEST_CHAPTER: "server:quest-chapter",
} as const;

export const ClientJoinSchema = z.object({
  worldId: z.string().min(1),
});
export type ClientJoinPayload = z.infer<typeof ClientJoinSchema>;

export const ClientResyncSchema = z.object({
  worldId: z.string().min(1),
  lastTick: z.number().int().nonnegative(),
});
export type ClientResyncPayload = z.infer<typeof ClientResyncSchema>;

export const ServerJoinedSchema = z.object({
  worldId: z.string(),
  tick: z.number().int().nonnegative(),
});
export type ServerJoinedPayload = z.infer<typeof ServerJoinedSchema>;

export const ServerResyncSchema = z.object({
  tick: z.number().int().nonnegative(),
  snapshot: WorldSnapshotSchema,
});
export type ServerResyncPayload = z.infer<typeof ServerResyncSchema>;

export const ServerErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ServerErrorPayload = z.infer<typeof ServerErrorSchema>;

export const ServerVictorySchema = z.object({
  status: WorldStatusSchema,
  tick: z.number().int().nonnegative(),
  reason: z.enum(["REGION_DOMINANCE", "ASSET_TARGET", "RELIC_COLLECTOR"]),
});
export type ServerVictoryPayload = z.infer<typeof ServerVictorySchema>;

/** 主線任務章節完成推播（M28）：帶完整章節內容，前端不必另外查表。 */
export const ServerQuestChapterSchema = z.object({
  tick: z.number().int().nonnegative(),
  chapterId: z.string(),
  title: z.string(),
  narrative: z.string(),
  goldReward: z.number().int(),
  fameReward: z.number().int(),
});
export type ServerQuestChapterPayload = z.infer<typeof ServerQuestChapterSchema>;
