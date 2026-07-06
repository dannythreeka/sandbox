import { z } from "zod";

export const BATTLE_STATUSES = ["ONGOING", "PLAYER_WIN", "PLAYER_LOSE", "FLED"] as const;
export const BattleStatusSchema = z.enum(BATTLE_STATUSES);
export type BattleStatusValue = z.infer<typeof BattleStatusSchema>;

const AxialSchema = z.object({ q: z.number().int(), r: z.number().int() });

export const BattleUnitSchema = z.object({
  id: z.string(),
  side: z.enum(["PLAYER", "ENEMY"]),
  name: z.string(),
  shipClassId: z.string(),
  pos: AxialSchema,
  hull: z.number().int(),
  maxHull: z.number().int(),
  crew: z.number().int(),
  maxCrew: z.number().int(),
  cannons: z.number().int(),
  speed: z.number().int(),
  fled: z.boolean(),
  destroyed: z.boolean(),
});
export type BattleUnitView = z.infer<typeof BattleUnitSchema>;

export const BattleStateSchema = z.object({
  round: z.number().int(),
  units: z.array(BattleUnitSchema),
  pendingUnitIds: z.array(z.string()),
});
export type BattleStateView = z.infer<typeof BattleStateSchema>;

export const BattleViewSchema = z.object({
  id: z.string(),
  status: BattleStatusSchema,
  state: BattleStateSchema,
});
export type BattleView = z.infer<typeof BattleViewSchema>;

export const BattleActionInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MOVE"), unitId: z.string(), to: AxialSchema }),
  z.object({ type: z.literal("FIRE"), unitId: z.string(), targetId: z.string() }),
  z.object({ type: z.literal("BOARD"), unitId: z.string(), targetId: z.string() }),
  z.object({ type: z.literal("REPAIR"), unitId: z.string() }),
  z.object({ type: z.literal("FLEE"), unitId: z.string() }),
]);
export type BattleActionInput = z.infer<typeof BattleActionInputSchema>;

// ── WS ──

export const ClientBattleActionSchema = z.object({
  battleId: z.string(),
  action: BattleActionInputSchema,
});
export type ClientBattleActionPayload = z.infer<typeof ClientBattleActionSchema>;

export const ServerBattleStartSchema = z.object({
  battleId: z.string(),
  battle: BattleViewSchema,
});
export type ServerBattleStartPayload = z.infer<typeof ServerBattleStartSchema>;

export const ServerBattleUpdateSchema = z.object({
  battleId: z.string(),
  state: BattleStateSchema,
  log: z.string(),
});
export type ServerBattleUpdatePayload = z.infer<typeof ServerBattleUpdateSchema>;

export const ServerBattleEndSchema = z.object({
  battleId: z.string(),
  status: BattleStatusSchema,
});
export type ServerBattleEndPayload = z.infer<typeof ServerBattleEndSchema>;
