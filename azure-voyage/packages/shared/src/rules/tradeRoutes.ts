/**
 * 貿易路線建議（docs/01 §4.2、M24）。純函式：輸入「起點港＋候選港」的市場快照
 * （已算好各港的有效買/賣價），算出「在起點買、去哪個港賣」的獲利建議，
 * 按「單位獲利 / 航行距離」排序——距離用 hex 格數，越近的高獲利路線分數越高。
 */
import { offsetDistance, type OffsetCoord } from "./hex";

export interface PortMarketSnapshot {
  portId: string;
  portName: string;
  coord: OffsetCoord;
  /** 該港各商品的目前有效買/賣價（已套用影響力折扣） */
  listings: { commodityId: string; buyPrice: number; sellPrice: number }[];
  /**
   * 情報時效性（M32，市場情報不完全）：undefined 代表即時真相（玩家目前所在的
   * 起點港）；數字代表這是「上次實際抵達當下」凍結的舊情報，距今經過幾個 tick。
   */
  intelAgeTicks?: number;
}

export interface TradeRouteSuggestion {
  commodityId: string;
  buyPortId: string;
  buyPrice: number;
  sellPortId: string;
  sellPortName: string;
  sellPrice: number;
  profitPerUnit: number;
  distance: number;
  /** 排序依據：單位獲利 / max(1, 距離)，距離越近、獲利越高分數越高 */
  score: number;
  /** 賣出港情報的時效性；undefined＝即時（不會發生，賣出港恆為非起點港），見 PortMarketSnapshot#intelAgeTicks */
  sellIntelAgeTicks?: number;
}

export function bestTradeRoutesFrom(
  origin: PortMarketSnapshot,
  candidates: readonly PortMarketSnapshot[],
  limit = 10,
): TradeRouteSuggestion[] {
  const suggestions: TradeRouteSuggestion[] = [];

  for (const listing of origin.listings) {
    for (const target of candidates) {
      if (target.portId === origin.portId) continue;
      const targetListing = target.listings.find((l) => l.commodityId === listing.commodityId);
      if (!targetListing) continue;

      const profitPerUnit = targetListing.sellPrice - listing.buyPrice;
      if (profitPerUnit <= 0) continue;

      const distance = offsetDistance(origin.coord, target.coord);
      suggestions.push({
        commodityId: listing.commodityId,
        buyPortId: origin.portId,
        buyPrice: listing.buyPrice,
        sellPortId: target.portId,
        sellPortName: target.portName,
        sellPrice: targetListing.sellPrice,
        profitPerUnit,
        distance,
        score: profitPerUnit / Math.max(1, distance),
        sellIntelAgeTicks: target.intelAgeTicks,
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
}
