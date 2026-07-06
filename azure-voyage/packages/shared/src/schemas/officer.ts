import { z } from "zod";
import { OFFICER_ROLES } from "../content/officersPool";

export const OfficerRoleSchema = z.enum(OFFICER_ROLES);

export const TavernOfficerViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  portrait: z.string(),
  stats: z.object({
    lead: z.number().int(),
    nav: z.number().int(),
    combat: z.number().int(),
    trade: z.number().int(),
    lore: z.number().int(),
  }),
  skills: z.array(z.string()),
  salary: z.number().int(),
});
export type TavernOfficerView = z.infer<typeof TavernOfficerViewSchema>;

export const RecruitInputSchema = z.object({
  fleetId: z.string().min(1),
  officerId: z.string().min(1),
});
export type RecruitInput = z.infer<typeof RecruitInputSchema>;

export const AssignRoleInputSchema = z.object({
  role: OfficerRoleSchema.nullable(),
});
export type AssignRoleInput = z.infer<typeof AssignRoleInputSchema>;

// ── 造船廠 ──

export const BuildShipInputSchema = z.object({
  fleetId: z.string().min(1),
  shipClassId: z.string().min(1),
  name: z.string().min(1).max(30),
});
export type BuildShipInput = z.infer<typeof BuildShipInputSchema>;

export const RepairInputSchema = z.object({
  fleetId: z.string().min(1),
  shipId: z.string().optional(),
});
export type RepairInput = z.infer<typeof RepairInputSchema>;

export const SellShipInputSchema = z.object({
  fleetId: z.string().min(1),
  shipId: z.string().min(1),
});
export type SellShipInput = z.infer<typeof SellShipInputSchema>;
