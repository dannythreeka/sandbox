import { z } from "zod";

export const SetRouteInputSchema = z.object({
  targetPortId: z.string().min(1),
});
export type SetRouteInput = z.infer<typeof SetRouteInputSchema>;

export const RouteViewSchema = z.object({
  waypoints: z.array(z.object({ col: z.number().int(), row: z.number().int() })),
  cursor: z.number().int().nonnegative(),
  targetPortId: z.string().optional(),
});
export type RouteView = z.infer<typeof RouteViewSchema>;

export const DepartInputSchema = z.object({
  confirm: z.boolean().optional(),
});
export type DepartInput = z.infer<typeof DepartInputSchema>;

// ── WS: 航行相關（docs/04 §7）──

export const ClientAdvanceSchema = z.object({
  worldId: z.string().min(1),
  ticks: z.number().int().min(1).max(7).default(1),
});
export type ClientAdvancePayload = z.infer<typeof ClientAdvanceSchema>;

export const FleetTickDeltaSchema = z.object({
  id: z.string(),
  pos: z.object({ q: z.number().int(), r: z.number().int() }),
  activity: z.enum(["DOCKED", "SAILING", "ANCHORED", "EXPLORING", "IN_BATTLE"]),
  dockedPortId: z.string().nullable(),
  food: z.number().int(),
  water: z.number().int(),
  morale: z.number().int(),
});
export type FleetTickDelta = z.infer<typeof FleetTickDeltaSchema>;

export const ServerTickSchema = z.object({
  tick: z.number().int().nonnegative(),
  fleets: z.array(FleetTickDeltaSchema),
  notices: z.array(z.string()),
});
export type ServerTickPayload = z.infer<typeof ServerTickSchema>;

export const ServerArrivalSchema = z.object({
  tick: z.number().int().nonnegative(),
  fleetId: z.string(),
  portId: z.string(),
});
export type ServerArrivalPayload = z.infer<typeof ServerArrivalSchema>;
