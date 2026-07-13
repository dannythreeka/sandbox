/**
 * 市場價格與影響力折扣（docs/05 §2）。
 * M3 簡化：distanceFactor / eventFactor 尚未建模（分別留給地圖產地距離矩陣與
 * WorldEvent 系統），先固定為 1；供需曲線與影響力折扣已是完整實作。
 */
import type { CommodityCategory } from "../content/commodities";
import { BALANCE } from "../content/constants";

const ELASTICITY: Record<CommodityCategory, number> = {
  FOOD: 0.6,
  DRINK: 0.8,
  TEXTILE: 0.9,
  ORE: 0.8,
  WEAPONRY: 0.9,
  CRAFT: 1.0,
  LUXURY: 1.2,
  SPICE: 1.2,
};

/** 供需係數：庫存低於基準 → 係數 >1（漲價）；高於基準 → 係數 <1（跌價）。 */
export function supplyDemandFactor(
  stock: number,
  baseStock: number,
  category: CommodityCategory,
): number {
  const ratio = baseStock / Math.max(stock, 1);
  const factor = ratio ** ELASTICITY[category];
  return Math.min(3.0, Math.max(0.4, factor));
}

/** 市場「牌價」：不含任何特定商會的影響力折扣，供 UI 顯示與庫存回歸後重算。 */
export function computeMarketPrice(input: {
  basePrice: number;
  stock: number;
  baseStock: number;
  category: CommodityCategory;
}): number {
  const sd = supplyDemandFactor(input.stock, input.baseStock, input.category);
  return Math.max(1, Math.round(input.basePrice * sd));
}

/** 影響力折扣：每 10% share → 1%，上限 8%（docs/01 §4.3）。 */
export function influenceDiscount(sharePercent: number): number {
  return Math.min(BALANCE.MAX_INFLUENCE_DISCOUNT, Math.floor(sharePercent / 10) * 0.01);
}

/**
 * purserBonus：會計長（PURSER）職位加成（docs/01 §4.5，M23），與影響力折扣疊加，
 * 預設 0（無會計長時不受影響）。
 */
export function effectiveBuyPrice(marketPrice: number, sharePercent: number, purserBonus = 0): number {
  return Math.max(1, Math.round(marketPrice * (1 - influenceDiscount(sharePercent) - purserBonus)));
}

export function effectiveSellPrice(marketPrice: number, sharePercent: number, purserBonus = 0): number {
  const base = marketPrice * BALANCE.SELL_RATIO;
  return Math.max(1, Math.round(base * (1 + influenceDiscount(sharePercent) + purserBonus)));
}

/** 庫存回歸基準值（docs/05 §2）：每 tick 補回缺口的固定比例。 */
export function regenStock(stock: number, baseStock: number): number {
  return Math.round(stock + (baseStock - stock) * BALANCE.MARKET_REGEN_RATE);
}
