import { z } from "zod";
import { WorldSnapshotSchema } from "./world";

/** Socket.IO 事件名常數（前後端唯一來源，禁止手打字串） */
export const WS_EVENTS = {
  // client → server
  CLIENT_JOIN: "client:join",
  CLIENT_RESYNC: "client:resync",
  CLIENT_ADVANCE: "client:advance",
  BATTLE_ACTION: "battle:action",
  // server → client
  SERVER_JOINED: "server:joined",
  SERVER_RESYNC: "server:resync",
  SERVER_ERROR: "server:error",
  SERVER_TICK: "server:tick",
  SERVER_ARRIVAL: "server:arrival",
  SERVER_BATTLE_START: "server:battle-start",
  BATTLE_UPDATE: "battle:update",
  BATTLE_END: "battle:end",
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
