import { z } from "zod";

export const InvestInputSchema = z.object({
  amount: z.number().int().positive().max(10_000_000),
});
export type InvestInput = z.infer<typeof InvestInputSchema>;

export const InvestResultSchema = z.object({
  gain: z.number(),
});
export type InvestResult = z.infer<typeof InvestResultSchema>;
