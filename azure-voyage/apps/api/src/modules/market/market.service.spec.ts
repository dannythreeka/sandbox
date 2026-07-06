import { computeMarketPrice, effectiveBuyPrice, effectiveSellPrice } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { MarketService } from "./market.service";

const PORT_ID = "port.amber_gulf.aurelia";
const COMMODITY_ID = "com.wine"; // Aurelia 特產之一

interface FakeState {
  gold: number;
  marketStock: { id: string; commodityId: string; stock: number; baseStock: number; price: number; priceHistory?: unknown };
  cargo: { shipId: string; commodityId: string; quantity: number; avgBuyPrice: number }[];
  influence: { share: number; goodwill: number } | null;
}

function makePrisma(state: FakeState) {
  const world = { id: "w1", userId: "u1", status: "ACTIVE" };
  const fleet = {
    id: "f1",
    worldId: "w1",
    guildId: "g1",
    activity: "DOCKED",
    dockedPortId: PORT_ID as string | null,
  };
  const ship = { id: "s1", fleetId: "f1", shipClassId: "ship.lugger" };
  const portState = { id: "ps1" };

  const prisma = {
    gameWorld: { findUnique: jest.fn(async () => world) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  } as unknown as PrismaService;

  const tx = {
    fleet: { findUnique: jest.fn(async () => fleet) },
    ship: {
      findUnique: jest.fn(async () => ({ ...ship, cargo: state.cargo.filter((c) => c.shipId === "s1") })),
    },
    guild: {
      findUniqueOrThrow: jest.fn(async () => ({ id: "g1", gold: BigInt(state.gold) })),
      update: jest.fn(async ({ data }: { data: { gold: bigint } }) => {
        state.gold = Number(data.gold);
      }),
    },
    portState: {
      findUniqueOrThrow: jest.fn(async () => ({ ...portState, market: [state.marketStock] })),
    },
    portInfluence: {
      findUnique: jest.fn(async () =>
        state.influence
          ? { share: state.influence.share, goodwill: state.influence.goodwill }
          : null,
      ),
      upsert: jest.fn(async ({ create, update }: { create: { share: number }; update: { goodwill: { increment: number } } }) => {
        if (!state.influence) state.influence = { share: create.share, goodwill: 0 };
        state.influence.goodwill += update.goodwill.increment;
      }),
    },
    marketStock: {
      update: jest.fn(async ({ data }: { data: { stock: number; price: number } }) => {
        state.marketStock.stock = data.stock;
        state.marketStock.price = data.price;
      }),
    },
    cargoSlot: {
      upsert: jest.fn(async ({ create }: { create: { quantity: number; avgBuyPrice: number; commodityId: string } }) => {
        const idx = state.cargo.findIndex((c) => c.commodityId === create.commodityId);
        if (idx >= 0) state.cargo[idx] = { ...state.cargo[idx], ...create };
        else state.cargo.push({ shipId: "s1", ...create });
      }),
      deleteMany: jest.fn(async ({ where }: { where: { commodityId: string } }) => {
        state.cargo = state.cargo.filter((c) => c.commodityId !== where.commodityId);
      }),
    },
  };

  return { prisma, tx };
}

describe("MarketService.trade", () => {
  function baseState(overrides: Partial<FakeState> = {}): FakeState {
    return {
      gold: 10000,
      marketStock: { id: "ms1", commodityId: COMMODITY_ID, stock: 300, baseStock: 340, price: 85 },
      cargo: [],
      influence: null,
      ...overrides,
    };
  }

  it("executes a BUY order: deducts gold, adds cargo, decrements stock", async () => {
    const state = baseState();
    const { prisma } = makePrisma(state);
    const service = new MarketService(prisma);

    const result = await service.trade("u1", "w1", PORT_ID, {
      fleetId: "f1",
      shipId: "s1",
      orders: [{ commodityId: COMMODITY_ID, side: "BUY", quantity: 10 }],
    });

    const expectedUnit = effectiveBuyPrice(85, 0);
    expect(result.fills[0]).toMatchObject({ side: "BUY", quantity: 10, unitPrice: expectedUnit });
    expect(result.goldRemaining).toBe(10000 - expectedUnit * 10);
    expect(state.marketStock.stock).toBe(290);
    expect(state.cargo[0]).toMatchObject({ commodityId: COMMODITY_ID, quantity: 10 });
  });

  it("rejects a BUY beyond available stock", async () => {
    const state = baseState({ marketStock: { id: "ms1", commodityId: COMMODITY_ID, stock: 5, baseStock: 340, price: 85 } });
    const { prisma } = makePrisma(state);
    const service = new MarketService(prisma);

    await expect(
      service.trade("u1", "w1", PORT_ID, {
        fleetId: "f1",
        shipId: "s1",
        orders: [{ commodityId: COMMODITY_ID, side: "BUY", quantity: 10 }],
      }),
    ).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
  });

  it("rejects a BUY without enough gold", async () => {
    const state = baseState({ gold: 10 });
    const { prisma } = makePrisma(state);
    const service = new MarketService(prisma);

    await expect(
      service.trade("u1", "w1", PORT_ID, {
        fleetId: "f1",
        shipId: "s1",
        orders: [{ commodityId: COMMODITY_ID, side: "BUY", quantity: 10 }],
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_GOLD" });
  });

  it("rejects a BUY that would exceed cargo capacity", async () => {
    const state = baseState(); // ship.lugger cargoCapacity = 45, wine volume = 2 → max 22 units
    const { prisma } = makePrisma(state);
    const service = new MarketService(prisma);

    await expect(
      service.trade("u1", "w1", PORT_ID, {
        fleetId: "f1",
        shipId: "s1",
        orders: [{ commodityId: COMMODITY_ID, side: "BUY", quantity: 30 }],
      }),
    ).rejects.toMatchObject({ code: "CARGO_FULL" });
  });

  it("SELL requires owning enough cargo, and pays out gold at a markup-free spread", async () => {
    const state = baseState({ cargo: [{ shipId: "s1", commodityId: COMMODITY_ID, quantity: 5, avgBuyPrice: 80 }] });
    const { prisma } = makePrisma(state);
    const service = new MarketService(prisma);

    await expect(
      service.trade("u1", "w1", PORT_ID, {
        fleetId: "f1",
        shipId: "s1",
        orders: [{ commodityId: COMMODITY_ID, side: "SELL", quantity: 10 }],
      }),
    ).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });

    const result = await service.trade("u1", "w1", PORT_ID, {
      fleetId: "f1",
      shipId: "s1",
      orders: [{ commodityId: COMMODITY_ID, side: "SELL", quantity: 5 }],
    });
    const expectedUnit = effectiveSellPrice(85, 0);
    expect(result.fills[0]).toMatchObject({ side: "SELL", quantity: 5, unitPrice: expectedUnit });
    expect(state.cargo).toHaveLength(0); // 賣光後 slot 應被移除
    expect(state.marketStock.stock).toBe(305);
  });

  it("rejects trading at a port the fleet is not docked at", async () => {
    const state = baseState();
    const { prisma, tx } = makePrisma(state);
    tx.fleet.findUnique = jest.fn(async () => ({
      id: "f1",
      worldId: "w1",
      guildId: "g1",
      activity: "SAILING",
      dockedPortId: null as string | null,
    }));
    const service = new MarketService(prisma);

    await expect(
      service.trade("u1", "w1", PORT_ID, {
        fleetId: "f1",
        shipId: "s1",
        orders: [{ commodityId: COMMODITY_ID, side: "BUY", quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: "PORT_NOT_DOCKED" });
  });

  it("accrues goodwill on the player's port influence after a trade", async () => {
    const state = baseState();
    const { prisma } = makePrisma(state);
    const service = new MarketService(prisma);

    await service.trade("u1", "w1", PORT_ID, {
      fleetId: "f1",
      shipId: "s1",
      orders: [{ commodityId: COMMODITY_ID, side: "BUY", quantity: 10 }],
    });

    expect(state.influence?.goodwill).toBeGreaterThan(0);
  });

  it("recomputes price using the shared pricing curve after stock changes", async () => {
    const state = baseState(); // ship.lugger cargoCapacity = 45, wine volume = 2 → max 22 units
    const { prisma } = makePrisma(state);
    const service = new MarketService(prisma);

    await service.trade("u1", "w1", PORT_ID, {
      fleetId: "f1",
      shipId: "s1",
      orders: [{ commodityId: COMMODITY_ID, side: "BUY", quantity: 20 }],
    });

    const expectedPrice = computeMarketPrice({
      basePrice: 85,
      stock: 280,
      baseStock: 340,
      category: "DRINK",
    });
    expect(state.marketStock.price).toBe(expectedPrice);
  });
});
