import { z } from "zod";

/**
 * 對話代理（docs/06 §5 DIALOGUE）：玩家與港口 NPC（商會使節／航海士／港口人物）的
 * 即時對話。對話預設不影響遊戲狀態；唯一例外是模型可觸發「傳聞」事件（rumorTriggered）。
 */

export const DIALOGUE_TARGET_TYPES = ["GUILD", "OFFICER", "PORT_NOTABLE"] as const;
export const DialogueTargetTypeSchema = z.enum(DIALOGUE_TARGET_TYPES);
export type DialogueTargetType = z.infer<typeof DialogueTargetTypeSchema>;

export const DialogueRequestSchema = z.object({
  targetType: DialogueTargetTypeSchema,
  targetId: z.string().min(1),
  message: z.string().min(1).max(300),
});
export type DialogueRequest = z.infer<typeof DialogueRequestSchema>;

export const DialogueTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type DialogueTurn = z.infer<typeof DialogueTurnSchema>;

export const DialogueResponseSchema = z.object({
  reply: z.string(),
  /** 這輪對話是否觸發了一則傳聞事件（offer_rumor 工具呼叫） */
  rumorTriggered: z.boolean(),
});
export type DialogueResponse = z.infer<typeof DialogueResponseSchema>;
