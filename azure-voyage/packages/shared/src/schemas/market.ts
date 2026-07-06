import { z } from "zod";

export const TRADE_SIDES = ["BUY", "SELL"] as const;
export const TradeSideSchema = z.enum(TRADE_SIDES);
export type TradeSide = z.infer<typeof TradeSideSchema>;

export const TradeOrderSchema = z.object({
  commodityId: z.string().min(1),
  side: TradeSideSchema,
  quantity: z.number().int().positive().max(100000),
});
export type TradeOrder = z.infer<typeof TradeOrderSchema>;

export const TradeInputSchema = z.object({
  fleetId: z.string().min(1),
  shipId: z.string().min(1),
  orders: z.array(TradeOrderSchema).min(1).max(20),
});
export type TradeInput = z.infer<typeof TradeInputSchema>;

export const TradeFillSchema = z.object({
  commodityId: z.string(),
  side: TradeSideSchema,
  quantity: z.number().int(),
  unitPrice: z.number().int(),
  total: z.number().int(),
});
export type TradeFill = z.infer<typeof TradeFillSchema>;

export const TradeResultSchema = z.object({
  fills: z.array(TradeFillSchema),
  goldRemaining: z.number().int(),
});
export type TradeResult = z.infer<typeof TradeResultSchema>;

// ── 港口詳情（市場 + 影響力）──

export const MarketListingSchema = z.object({
  commodityId: z.string(),
  stock: z.number().int(),
  buyPrice: z.number().int(),
  sellPrice: z.number().int(),
  priceHistory: z.array(z.object({ t: z.number().int(), p: z.number().int() })),
});
export type MarketListing = z.infer<typeof MarketListingSchema>;

export const PortInfluenceViewSchema = z.object({
  guildId: z.string(),
  guildName: z.string(),
  color: z.string(),
  share: z.number(),
});
export type PortInfluenceView = z.infer<typeof PortInfluenceViewSchema>;

export const PortDetailSchema = z.object({
  portId: z.string(),
  name: z.string(),
  regionId: z.string(),
  size: z.number().int(),
  prosperity: z.number().int(),
  market: z.array(MarketListingSchema),
  influences: z.array(PortInfluenceViewSchema),
  playerShare: z.number(),
});
export type PortDetail = z.infer<typeof PortDetailSchema>;
