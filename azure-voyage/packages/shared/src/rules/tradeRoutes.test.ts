import { describe, expect, it } from "vitest";
import { bestTradeRoutesFrom, type PortMarketSnapshot } from "./tradeRoutes";

function port(portId: string, portName: string, coord: { col: number; row: number }, listings: { commodityId: string; buyPrice: number; sellPrice: number }[]): PortMarketSnapshot {
  return { portId, portName, coord, listings };
}

describe("bestTradeRoutesFrom", () => {
  it("suggests a profitable route when a commodity sells higher elsewhere", () => {
    const origin = port("p.a", "A港", { col: 0, row: 0 }, [{ commodityId: "com.wine", buyPrice: 10, sellPrice: 9 }]);
    const target = port("p.b", "B港", { col: 4, row: 0 }, [{ commodityId: "com.wine", buyPrice: 20, sellPrice: 25 }]);

    const result = bestTradeRoutesFrom(origin, [origin, target]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      commodityId: "com.wine",
      buyPortId: "p.a",
      sellPortId: "p.b",
      sellPortName: "B港",
      profitPerUnit: 15, // 25 - 10
    });
    expect(result[0].distance).toBeGreaterThan(0);
  });

  it("excludes the origin port itself and non-profitable/unmatched commodities", () => {
    const origin = port("p.a", "A港", { col: 0, row: 0 }, [
      { commodityId: "com.wine", buyPrice: 10, sellPrice: 9 },
      { commodityId: "com.iron_ore", buyPrice: 5, sellPrice: 4 },
    ]);
    const sameGoodCheaperElsewhere = port("p.b", "B港", { col: 1, row: 0 }, [
      { commodityId: "com.wine", buyPrice: 8, sellPrice: 7 }, // 賣價比買價低，無利可圖
    ]);
    const noOverlap = port("p.c", "C港", { col: 2, row: 0 }, [
      { commodityId: "com.silk", buyPrice: 30, sellPrice: 40 }, // 起點根本沒賣這個商品
    ]);

    const result = bestTradeRoutesFrom(origin, [origin, sameGoodCheaperElsewhere, noOverlap]);
    expect(result).toHaveLength(0);
  });

  it("sorts by profit-per-distance score, not raw profit alone", () => {
    const origin = port("p.a", "A港", { col: 0, row: 0 }, [{ commodityId: "com.wine", buyPrice: 10, sellPrice: 10 }]);
    const near = port("p.near", "近港", { col: 1, row: 0 }, [{ commodityId: "com.wine", buyPrice: 0, sellPrice: 20 }]);
    const far = port("p.far", "遠港", { col: 50, row: 0 }, [{ commodityId: "com.wine", buyPrice: 0, sellPrice: 25 }]);

    const result = bestTradeRoutesFrom(origin, [origin, near, far]);
    expect(result[0].sellPortId).toBe("p.near"); // 獲利略低但距離近很多，分數應該較高
  });

  it("respects the limit parameter", () => {
    const origin = port("p.a", "A港", { col: 0, row: 0 }, [{ commodityId: "com.wine", buyPrice: 1, sellPrice: 1 }]);
    const targets = Array.from({ length: 20 }, (_, i) =>
      port(`p.${i}`, `港${i}`, { col: i + 1, row: 0 }, [{ commodityId: "com.wine", buyPrice: 0, sellPrice: 10 + i }]),
    );

    const result = bestTradeRoutesFrom(origin, [origin, ...targets], 5);
    expect(result).toHaveLength(5);
  });
});
