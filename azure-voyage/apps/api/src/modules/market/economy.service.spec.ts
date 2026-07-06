import { computeMarketPrice, regenStock } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { EconomyService } from "./economy.service";

describe("EconomyService.regenAllPorts", () => {
  it("regenerates stock toward baseline and recomputes price for every row", async () => {
    const rows = [
      { id: "m1", commodityId: "com.wine", stock: 100, baseStock: 340, price: 85, priceHistory: [] },
      { id: "m2", commodityId: "com.iron_ore", stock: 400, baseStock: 200, price: 35, priceHistory: [{ t: 0, p: 35 }] },
    ];
    const updated: Record<string, { stock: number; price: number; priceHistory: unknown }> = {};
    const prisma = {
      marketStock: {
        findMany: jest.fn(async () => rows),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: typeof updated[string] }) => {
          updated[where.id] = data;
        }),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const service = new EconomyService(prisma);
    await service.regenAllPorts("w1", 5);

    expect(updated.m1.stock).toBe(regenStock(100, 340));
    expect(updated.m1.price).toBe(
      computeMarketPrice({ basePrice: 85, stock: updated.m1.stock, baseStock: 340, category: "DRINK" }),
    );
    expect(updated.m2.stock).toBe(regenStock(400, 200));
    expect(updated.m2.priceHistory).toEqual([{ t: 0, p: 35 }, { t: 5, p: updated.m2.price }]);
  });

  it("caps priceHistory at 60 entries", async () => {
    const longHistory = Array.from({ length: 60 }, (_, i) => ({ t: i, p: 10 }));
    const rows = [{ id: "m1", commodityId: "com.wine", stock: 300, baseStock: 340, price: 85, priceHistory: longHistory }];
    const updated: Record<string, { priceHistory: { t: number; p: number }[] }> = {};
    const prisma = {
      marketStock: {
        findMany: jest.fn(async () => rows),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: typeof updated[string] }) => {
          updated[where.id] = data;
        }),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const service = new EconomyService(prisma);
    await service.regenAllPorts("w1", 61);

    expect(updated.m1.priceHistory).toHaveLength(60);
    expect(updated.m1.priceHistory[59].t).toBe(61);
  });
});
