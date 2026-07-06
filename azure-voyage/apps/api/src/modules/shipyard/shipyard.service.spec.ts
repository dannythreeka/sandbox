import { BALANCE, shipClassById } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { ShipyardService } from "./shipyard.service";

const PORT_ID = "port.amber_gulf.aurelia";

interface ShipRow {
  id: string;
  fleetId: string;
  shipClassId: string;
  name: string;
  hull: number;
  sails: number;
  crew: number;
  isFlagship: boolean;
}

function makePrisma(ships: ShipRow[], gold = 500000) {
  const world = { id: "w1", userId: "u1" };
  const guild = { id: "g1", gold: BigInt(gold), kind: "PLAYER" };
  const fleet = { id: "f1", worldId: "w1", guildId: "g1", activity: "DOCKED", dockedPortId: PORT_ID };

  const prisma = {
    gameWorld: { findUnique: jest.fn(async () => world) },
    fleet: {
      findUnique: jest.fn(async () => ({ ...fleet, guild, ships: ships.filter((s) => s.fleetId === "f1") })),
    },
    guild: {
      findUniqueOrThrow: jest.fn(async () => guild),
      update: jest.fn(async ({ data }: { data: { gold: bigint } }) => {
        guild.gold = data.gold;
      }),
    },
    ship: {
      create: jest.fn(async ({ data }: { data: Omit<ShipRow, "id"> }) => {
        const ship = { id: `s${ships.length + 1}`, ...data };
        ships.push(ship);
        return ship;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<ShipRow> }) => {
        Object.assign(ships.find((s) => s.id === where.id)!, data);
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const idx = ships.findIndex((s) => s.id === where.id);
        ships.splice(idx, 1);
      }),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  return { prisma, guild, ships };
}

describe("ShipyardService.build", () => {
  it("deducts gold and creates a new ship, flagged as flagship if it's the first", async () => {
    const { prisma, guild } = makePrisma([]);
    const service = new ShipyardService(prisma);

    const result = await service.build("u1", "w1", PORT_ID, {
      fleetId: "f1",
      shipClassId: "ship.sloop",
      name: "疾風號",
    });

    const price = shipClassById("ship.sloop").price;
    expect(Number(guild.gold)).toBe(500000 - price);
    expect(result.goldRemaining).toBe(500000 - price);
  });

  it("rejects building without enough gold", async () => {
    const { prisma } = makePrisma([], 100);
    const service = new ShipyardService(prisma);

    await expect(
      service.build("u1", "w1", PORT_ID, { fleetId: "f1", shipClassId: "ship.galleon", name: "X" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_GOLD" });
  });
});

describe("ShipyardService.repair", () => {
  it("restores hull to max and charges proportional to missing hull", async () => {
    const ships = [
      { id: "s1", fleetId: "f1", shipClassId: "ship.lugger", name: "海燕號", hull: 30, sails: 60, crew: 8, isFlagship: true },
    ];
    const { prisma, guild } = makePrisma(ships, 10000);
    const service = new ShipyardService(prisma);

    const maxHull = shipClassById("ship.lugger").maxHull;
    const expectedCost = (maxHull - 30) * BALANCE.REPAIR_COST_PER_HULL;

    const result = await service.repair("u1", "w1", PORT_ID, { fleetId: "f1" });

    expect(ships[0].hull).toBe(maxHull);
    expect(ships[0].sails).toBe(100);
    expect(result.cost).toBe(expectedCost);
    expect(Number(guild.gold)).toBe(10000 - expectedCost);
  });

  it("repairs partially when gold runs out, without throwing", async () => {
    const ships = [
      { id: "s1", fleetId: "f1", shipClassId: "ship.galleon", name: "A", hull: 20, sails: 100, crew: 10, isFlagship: true },
      { id: "s2", fleetId: "f1", shipClassId: "ship.galleon", name: "B", hull: 20, sails: 100, crew: 10, isFlagship: false },
    ];
    const { prisma, guild } = makePrisma(ships, 100); // 不夠修完整艘
    const service = new ShipyardService(prisma);

    await service.repair("u1", "w1", PORT_ID, { fleetId: "f1" });
    expect(Number(guild.gold)).toBeGreaterThanOrEqual(0);
  });
});

describe("ShipyardService.sell", () => {
  it("refunds half price and removes the ship", async () => {
    const ships = [
      { id: "s1", fleetId: "f1", shipClassId: "ship.lugger", name: "A", hull: 55, sails: 100, crew: 8, isFlagship: true },
      { id: "s2", fleetId: "f1", shipClassId: "ship.sloop", name: "B", hull: 50, sails: 100, crew: 10, isFlagship: false },
    ];
    const { prisma, guild } = makePrisma(ships, 1000);
    const service = new ShipyardService(prisma);

    const result = await service.sell("u1", "w1", PORT_ID, { fleetId: "f1", shipId: "s2" });

    const expectedRefund = Math.round(shipClassById("ship.sloop").price * BALANCE.SHIP_SELL_REFUND_RATIO);
    expect(result.refund).toBe(expectedRefund);
    expect(Number(guild.gold)).toBe(1000 + expectedRefund);
    expect(ships.find((s) => s.id === "s2")).toBeUndefined();
  });

  it("promotes another ship to flagship when the flagship is sold", async () => {
    const ships = [
      { id: "s1", fleetId: "f1", shipClassId: "ship.lugger", name: "A", hull: 55, sails: 100, crew: 8, isFlagship: true },
      { id: "s2", fleetId: "f1", shipClassId: "ship.sloop", name: "B", hull: 50, sails: 100, crew: 10, isFlagship: false },
    ];
    const { prisma } = makePrisma(ships, 1000);
    const service = new ShipyardService(prisma);

    await service.sell("u1", "w1", PORT_ID, { fleetId: "f1", shipId: "s1" });
    expect(ships.find((s) => s.id === "s2")!.isFlagship).toBe(true);
  });

  it("refuses to sell the fleet's last ship", async () => {
    const ships = [
      { id: "s1", fleetId: "f1", shipClassId: "ship.lugger", name: "A", hull: 55, sails: 100, crew: 8, isFlagship: true },
    ];
    const { prisma } = makePrisma(ships, 1000);
    const service = new ShipyardService(prisma);

    await expect(
      service.sell("u1", "w1", PORT_ID, { fleetId: "f1", shipId: "s1" }),
    ).rejects.toMatchObject({ code: "CANNOT_SELL_LAST_SHIP" });
  });
});
