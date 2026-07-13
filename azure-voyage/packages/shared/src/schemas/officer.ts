import { z } from "zod";
import { OFFICER_ROLES } from "../content/officersPool";
import { PersonaGenViewSchema } from "./world";

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
  persona: PersonaGenViewSchema.optional(),
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

// ── 多艦隊管理（M29）──

/** 從既有艦隊分出部分船隻（可選帶走部分航海士）成立一支新艦隊，停靠在同一港口。 */
export const SplitFleetInputSchema = z.object({
  sourceFleetId: z.string().min(1),
  shipIds: z.array(z.string().min(1)).min(1),
  officerIds: z.array(z.string().min(1)).default([]),
  name: z.string().min(1).max(30),
});
export type SplitFleetInput = z.infer<typeof SplitFleetInputSchema>;

export const SplitFleetResultSchema = z.object({
  fleetId: z.string(),
});
export type SplitFleetResult = z.infer<typeof SplitFleetResultSchema>;
