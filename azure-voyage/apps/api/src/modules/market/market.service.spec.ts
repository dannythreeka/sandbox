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
    officers: [] as { id: string; role: string | null; stats: unknown; exp: number }[],
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
    officer: {
      findMany: jest.fn(async () => fleet.officers),
      update: jest.fn(),
    },
  };

  return { prisma, tx, fleet };
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

  it("a purser gives a better unit price and the fleet's officers gain exp (M23)", async () => {
    const state = baseState();
    const { prisma, tx, fleet } = makePrisma(state);
    fleet.officers.push({
      id: "purser1",
      role: "PURSER",
      stats: { lead: 0, nav: 0, combat: 0, trade: 100, lore: 0 },
      exp: 0,
    });
    const service = new MarketService(prisma);

    const result = await service.trade("u1", "w1", PORT_ID, {
      fleetId: "f1",
      shipId: "s1",
      orders: [{ commodityId: COMMODITY_ID, side: "BUY", quantity: 10 }],
    });

    const withoutPurser = effectiveBuyPrice(85, 0);
    expect(result.fills[0].unitPrice).toBeLessThan(withoutPurser);
    expect(tx.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "purser1" } }),
    );
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
      officers: [] as { id: string; role: string | null; stats: unknown; exp: number }[],
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

describe("MarketService.getTradeRouteSuggestions", () => {
  const ORIGIN_PORT_ID = "port.amber_gulf.aurelia";
  const TARGET_PORT_ID = "port.amber_gulf.mirenport";

  function makeTradeRoutePrisma() {
    const world = { id: "w1", userId: "u1", status: "ACTIVE" };
    const guild = { id: "g1", worldId: "w1", kind: "PLAYER" };
    const portStates = [
      {
        portId: ORIGIN_PORT_ID,
        market: [{ commodityId: "com.wine", price: 10, stock: 100, baseStock: 100 }],
        influences: [] as { guildId: string; share: number }[],
      },
      {
        portId: TARGET_PORT_ID,
        market: [{ commodityId: "com.wine", price: 30, stock: 100, baseStock: 100 }],
        influences: [] as { guildId: string; share: number }[],
      },
    ];

    const prisma = {
      gameWorld: { findUnique: jest.fn(async () => world) },
      guild: { findFirstOrThrow: jest.fn(async () => guild) },
      portState: { findMany: jest.fn(async () => portStates) },
    } as unknown as PrismaService;

    return { prisma };
  }

  it("suggests buying at the origin and selling at a port with a higher price", async () => {
    const { prisma } = makeTradeRoutePrisma();
    const service = new MarketService(prisma);

    const suggestions = await service.getTradeRouteSuggestions("u1", "w1", ORIGIN_PORT_ID);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      commodityId: "com.wine",
      buyPortId: ORIGIN_PORT_ID,
      sellPortId: TARGET_PORT_ID,
    });
    expect(suggestions[0].profitPerUnit).toBeGreaterThan(0);
  });

  it("rejects an unknown origin port", async () => {
    const { prisma } = makeTradeRoutePrisma();
    const service = new MarketService(prisma);

    await expect(
      service.getTradeRouteSuggestions("u1", "w1", "port.nowhere.fake"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("MarketService.getPortDetail", () => {
  const PORT_ID_2 = "port.amber_gulf.aurelia";

  it("includes the port notable when one exists (M25)", async () => {
    const world = { id: "w1", userId: "u1", status: "ACTIVE" };
    const playerGuild = { id: "g1", worldId: "w1", kind: "PLAYER" };
    const portState = {
      id: "ps1",
      prosperity: 60,
      market: [],
      influences: [] as { guildId: string; share: number; guild: { name: string; color: string } }[],
    };
    const notable = {
      id: "n1",
      name: "馬瑟斯・凡登霍夫",
      portrait: "portrait.notable_aurelia",
      archetype: "HARBORMASTER",
      persona: { description: "港務總管", greeting: "「歡迎來到本港。」" },
    };

    const prisma = {
      gameWorld: { findUnique: jest.fn(async () => world) },
      portState: { findUnique: jest.fn(async () => portState) },
      guild: { findFirstOrThrow: jest.fn(async () => playerGuild) },
      portNotable: { findUnique: jest.fn(async () => notable) },
    } as unknown as PrismaService;
    const service = new MarketService(prisma);

    const detail = await service.getPortDetail("u1", "w1", PORT_ID_2);

    expect(detail.notable).toMatchObject({
      id: "n1",
      name: "馬瑟斯・凡登霍夫",
      archetype: "HARBORMASTER",
      persona: { description: "港務總管", greeting: "「歡迎來到本港。」" },
    });
  });
});
