/**
 * 影響力（docs/01 §4.3、docs/05 §4）。
 * M3 範圍：只有 goodwillFromTrade（交易時累積商譽點，寫入 PortInfluence.goodwill）。
 * 完整的 decay/轉化/擠壓 settlement 引擎在 M7 才接上 tick 迴圈。
 */
import { BALANCE } from "../content/constants";

/** 邊際遞減：交易額越高、現有份額越高，累積速度越慢。 */
export function goodwillFromTrade(tradeValue: number, currentSharePercent: number): number {
  const marginal = Math.max(0, 1 - currentSharePercent / 120);
  return BALANCE.GOODWILL_K * Math.sqrt(Math.max(0, tradeValue)) * marginal;
}
