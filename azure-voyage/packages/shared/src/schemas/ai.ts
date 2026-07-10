import { z } from "zod";

/**
 * AI Agent 輸出 schema（docs/06 §4）。AI 只產生「受 schema 約束的提案」，
 * 由規則層驗證、夾限並套用——AI 永不直接寫入遊戲狀態。
 */

// ── NPC 策略家（NPC_STRATEGY）──

/** M8 範圍：執行器仍只有「投資港口」這個原子行動，goal.kind 只決定挑選哪個港口。 */
export const NPC_GOAL_KINDS = ["EXPAND_INFLUENCE", "CONSOLIDATE", "INVEST_PORT"] as const;
export const NpcGoalKindSchema = z.enum(NPC_GOAL_KINDS);
export type NpcGoalKind = z.infer<typeof NpcGoalKindSchema>;

export const NpcGoalSchema = z.object({
  kind: NpcGoalKindSchema,
  regionId: z.string().min(1),
  /** 指定的目標港口（可留空，交由執行器在 regionId 內自選） */
  portIds: z.array(z.string()).max(3).default([]),
  /** 1-5，數字越大優先度越高 */
  priority: z.number().int().min(1).max(5),
});
export type NpcGoal = z.infer<typeof NpcGoalSchema>;

export const NpcStrategySchema = z.object({
  reasoning: z.string().max(300).optional(), // 僅供除錯 log，不進遊戲邏輯
  goals: z.array(NpcGoalSchema).min(1).max(4),
  validUntilTick: z.number().int().nonnegative(),
});
export type NpcStrategy = z.infer<typeof NpcStrategySchema>;

// ── 世界事件生成器（EVENT_GEN）──

/** M8 範圍：只做敘事型「傳聞」事件（立即結算的金錢/聲望獎勵），不含地圖機制效果。 */
export const AI_EVENT_TYPES = ["RUMOR"] as const;
export const AiEventTypeSchema = z.enum(AI_EVENT_TYPES);
export type AiEventType = z.infer<typeof AiEventTypeSchema>;

export const AiEventProposalSchema = z.object({
  type: AiEventTypeSchema,
  title: z.string().min(1).max(40),
  narrative: z.string().min(1).max(600),
  goldReward: z.number().int().min(0).max(2000),
  fameReward: z.number().int().min(0).max(20),
});
export type AiEventProposal = z.infer<typeof AiEventProposalSchema>;

// ── 人設生成器（PERSONA）──

/** AI 只生成敘事欄位；archetype/riskTolerance 等既有數值資料不經 AI，維持規則層產生。 */
export const NpcPersonaGenSchema = z.object({
  description: z.string().min(1).max(400),
  greeting: z.string().min(1).max(150),
});
export type NpcPersonaGen = z.infer<typeof NpcPersonaGenSchema>;

export const OfficerPersonaGenSchema = z.object({
  description: z.string().min(1).max(300),
  greeting: z.string().min(1).max(150),
});
export type OfficerPersonaGen = z.infer<typeof OfficerPersonaGenSchema>;
