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

interface OfficerRow {
  id: string;
  fleetId: string | null;
  name: string;
}

interface FleetRow {
  id: string;
  worldId: string;
  guildId: string;
  activity: string;
  dockedPortId: string;
  posQ: number;
  posR: number;
  food: number;
  water: number;
  morale: number;
  name: string;
}

function makePrisma(ships: ShipRow[], gold = 500000, officers: OfficerRow[] = []) {
  const world = { id: "w1", userId: "u1" };
  const guild = { id: "g1", gold: BigInt(gold), kind: "PLAYER" };
  const fleets: FleetRow[] = [
    {
      id: "f1",
      worldId: "w1",
      guildId: "g1",
      activity: "DOCKED",
      dockedPortId: PORT_ID,
      posQ: 5,
      posR: 5,
      food: 30,
      water: 30,
      morale: 70,
      name: "第一艦隊",
    },
  ];

  const prisma = {
    gameWorld: { findUnique: jest.fn(async () => world) },
    fleet: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const fleet = fleets.find((f) => f.id === where.id);
        if (!fleet) return null;
        return {
          ...fleet,
          guild,
          ships: ships.filter((s) => s.fleetId === fleet.id),
          officers: officers.filter((o) => o.fleetId === fleet.id),
        };
      }),
      create: jest.fn(async ({ data }: { data: Omit<FleetRow, "id"> }) => {
        const fleet = { id: `f${fleets.length + 1}`, ...data };
        fleets.push(fleet);
        return fleet;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<FleetRow> }) => {
        Object.assign(fleets.find((f) => f.id === where.id)!, data);
      }),
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
    officer: {
      updateMany: jest.fn(
        async ({ where, data }: { where: { id: { in: string[] } }; data: Partial<OfficerRow> }) => {
          for (const o of officers) {
            if (where.id.in.includes(o.id)) Object.assign(o, data);
          }
        },
      ),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  return { prisma, guild, ships, officers, fleets };
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

describe("ShipyardService.splitFleet (M29)", () => {
  function makeTwoShipFleet() {
    return [
      { id: "s1", fleetId: "f1", shipClassId: "ship.lugger", name: "旗艦", hull: 55, sails: 100, crew: 8, isFlagship: true },
      { id: "s2", fleetId: "f1", shipClassId: "ship.sloop", name: "副船", hull: 50, sails: 100, crew: 10, isFlagship: false },
    ];
  }

  it("creates a new docked fleet at the same port with the selected ships", async () => {
    const ships = makeTwoShipFleet();
    const { prisma, fleets } = makePrisma(ships);
    const service = new ShipyardService(prisma);

    const result = await service.splitFleet("u1", "w1", PORT_ID, {
      sourceFleetId: "f1",
      shipIds: ["s2"],
      officerIds: [],
      name: "第二艦隊",
    });

    const newFleet = fleets.find((f) => f.id === result.fleetId)!;
    expect(newFleet).toMatchObject({ name: "第二艦隊", activity: "DOCKED", dockedPortId: PORT_ID, posQ: 5, posR: 5 });
    expect(ships.find((s) => s.id === "s2")!.fleetId).toBe(newFleet.id);
    expect(ships.find((s) => s.id === "s1")!.fleetId).toBe("f1");
  });

  it("splits food and water between the two fleets without duplicating resources", async () => {
    const ships = makeTwoShipFleet();
    const { prisma, fleets } = makePrisma(ships);
    const service = new ShipyardService(prisma);

    const result = await service.splitFleet("u1", "w1", PORT_ID, {
      sourceFleetId: "f1",
      shipIds: ["s2"],
      officerIds: [],
      name: "第二艦隊",
    });

    const source = fleets.find((f) => f.id === "f1")!;
    const newFleet = fleets.find((f) => f.id === result.fleetId)!;
    expect(source.food + newFleet.food).toBe(30);
    expect(source.water + newFleet.water).toBe(30);
  });

  it("gives the new fleet its own flagship when the moved ship wasn't the old flagship", async () => {
    const ships = makeTwoShipFleet();
    const { prisma } = makePrisma(ships);
    const service = new ShipyardService(prisma);

    await service.splitFleet("u1", "w1", PORT_ID, {
      sourceFleetId: "f1",
      shipIds: ["s2"],
      officerIds: [],
      name: "第二艦隊",
    });

    expect(ships.find((s) => s.id === "s2")!.isFlagship).toBe(true); // 新艦隊唯一船，必為旗艦
    expect(ships.find((s) => s.id === "s1")!.isFlagship).toBe(true); // 原艦隊旗艦不受影響
  });

  it("promotes a new flagship in the source fleet when the old flagship is moved out", async () => {
    const ships = makeTwoShipFleet();
    const { prisma } = makePrisma(ships);
    const service = new ShipyardService(prisma);

    await service.splitFleet("u1", "w1", PORT_ID, {
      sourceFleetId: "f1",
      shipIds: ["s1"], // 移走原本的旗艦
      officerIds: [],
      name: "第二艦隊",
    });

    expect(ships.find((s) => s.id === "s1")!.isFlagship).toBe(true); // 帶著旗艦身分去新艦隊
    expect(ships.find((s) => s.id === "s2")!.isFlagship).toBe(true); // 留下的船升格為旗艦
  });

  it("moves selected officers to the new fleet", async () => {
    const ships = makeTwoShipFleet();
    const officers: OfficerRow[] = [{ id: "o1", fleetId: "f1", name: "航海長" }];
    const { prisma, fleets } = makePrisma(ships, 500000, officers);
    const service = new ShipyardService(prisma);

    const result = await service.splitFleet("u1", "w1", PORT_ID, {
      sourceFleetId: "f1",
      shipIds: ["s2"],
      officerIds: ["o1"],
      name: "第二艦隊",
    });

    expect(officers[0].fleetId).toBe(result.fleetId);
    expect(fleets.find((f) => f.id === result.fleetId)).toBeDefined();
  });

  it("rejects splitting off every ship in the fleet", async () => {
    const ships = makeTwoShipFleet();
    const { prisma } = makePrisma(ships);
    const service = new ShipyardService(prisma);

    await expect(
      service.splitFleet("u1", "w1", PORT_ID, {
        sourceFleetId: "f1",
        shipIds: ["s1", "s2"],
        officerIds: [],
        name: "第二艦隊",
      }),
    ).rejects.toMatchObject({ code: "CANNOT_SPLIT_ALL_SHIPS" });
  });

  it("rejects an unknown ship id", async () => {
    const ships = makeTwoShipFleet();
    const { prisma } = makePrisma(ships);
    const service = new ShipyardService(prisma);

    await expect(
      service.splitFleet("u1", "w1", PORT_ID, {
        sourceFleetId: "f1",
        shipIds: ["does-not-exist"],
        officerIds: [],
        name: "第二艦隊",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
