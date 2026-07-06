import { Injectable } from "@nestjs/common";
import { commodityById, computeMarketPrice, regenStock } from "@azure-voyage/shared";
import { PrismaService } from "../../prisma/prisma.service";

const PRICE_HISTORY_MAX = 60;

@Injectable()
export class EconomyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 每 tick 的庫存回歸與價格重算（docs/05 §1 PHASE 6）。
   * M3 簡化：對世界內所有港口統一處理（規模夠小，不需要「只算 dirty 港口」的優化）。
   */
  async regenAllPorts(worldId: string, tick: number): Promise<void> {
    const rows = await this.prisma.marketStock.findMany({
      where: { portState: { worldId } },
    });

    await this.prisma.$transaction(
      rows.map((row) => {
        const commodity = commodityById(row.commodityId);
        const newStock = regenStock(row.stock, row.baseStock);
        const newPrice = computeMarketPrice({
          basePrice: commodity.basePrice,
          stock: newStock,
          baseStock: row.baseStock,
          category: commodity.category,
        });
        const history = [
          ...(row.priceHistory as { t: number; p: number }[]),
          { t: tick, p: newPrice },
        ].slice(-PRICE_HISTORY_MAX);

        return this.prisma.marketStock.update({
          where: { id: row.id },
          data: { stock: newStock, price: newPrice, priceHistory: history },
        });
      }),
    );
  }
}
