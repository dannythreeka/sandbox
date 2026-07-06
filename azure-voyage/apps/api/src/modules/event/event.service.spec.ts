import { BALANCE, oddrToAxial, portById, shipClassById } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { EventService } from "./event.service";

// 子午之海危險度高，用來確保風暴確實有機會觸發
const DANGEROUS_AXIAL = oddrToAxial(portById("port.meridian.zafrahn").coord);

function makePrisma(overrides: { seed?: number } = {}) {
  const world = { id: "w1", seed: overrides.seed ?? 1 };
  const ships = [
    { id: "s1", fleetId: "f1", shipClassId: "ship.lugger", hull: shipClassById("ship.lugger").maxHull },
  ];
  const fleet = {
    id: "f1",
    worldId: "w1",
    activity: "SAILING",
    posQ: DANGEROUS_AXIAL.q,
    posR: DANGEROUS_AXIAL.r,
    food: 30,
    water: 30,
  };
  const worldEvents: { type: string; status: string; payload: unknown; expireTick?: number }[] = [];
  const portStates: Record<string, { id: string; prosperity: number }> = {
    "port.amber_gulf.aurelia": { id: "ps1", prosperity: 70 },
  };

  const prisma = {
    gameWorld: { findUniqueOrThrow: jest.fn(async () => world) },
    fleet: {
      findMany: jest.fn(async () => [{ ...fleet, ships }]),
      update: jest.fn(async ({ data }: { data: Partial<typeof fleet> }) => Object.assign(fleet, data)),
    },
    ship: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<{ hull: number }> }) => {
        Object.assign(ships.find((s) => s.id === where.id)!, data);
      }),
    },
    portState: {
      findUnique: jest.fn(async ({ where }: { where: { worldId_portId: { portId: string } } }) =>
        portStates[where.worldId_portId.portId] ?? null,
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<{ prosperity: number }> }) => {
        const entry = Object.values(portStates).find((p) => p.id === where.id)!;
        Object.assign(entry, data);
      }),
    },
    worldEvent: {
      create: jest.fn(async ({ data }: { data: (typeof worldEvents)[number] }) => {
        worldEvents.push(data);
        return { id: `e${worldEvents.length}`, ...data };
      }),
      findMany: jest.fn(async () =>
        worldEvents
          .map((e, i) => ({ id: `e${i + 1}`, ...e }))
          .filter((e) => e.type === "FESTIVAL" && e.status === "ACTIVE"),
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<{ status: string }> }) => {
        const idx = Number(where.id.slice(1)) - 1;
        Object.assign(worldEvents[idx], data);
      }),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  return { prisma, ships, fleet, worldEvents, portStates };
}

describe("EventService.rollStorms", () => {
  it("damages ships and drains supplies when a storm hits (scanning seeds for a hit)", async () => {
    let hit = false;
    for (let seed = 0; seed < 300 && !hit; seed++) {
      const { prisma, ships, fleet, worldEvents } = makePrisma({ seed });
      const service = new EventService(prisma, { emit: jest.fn() } as never);
      await service.rollStorms("w1", seed);
      if (worldEvents.length > 0) {
        hit = true;
        expect(ships[0].hull).toBeLessThan(shipClassById("ship.lugger").maxHull);
        expect(fleet.food).toBeLessThan(30);
        expect(fleet.water).toBeLessThan(30);
        expect(worldEvents[0].type).toBe("STORM");
        expect(worldEvents[0].status).toBe("RESOLVED");
      }
    }
    expect(hit).toBe(true);
  });

  it("never reduces a ship's hull below 1", async () => {
    for (let seed = 0; seed < 50; seed++) {
      const { prisma, ships } = makePrisma({ seed });
      ships[0].hull = 1; // 已經瀕死
      const service = new EventService(prisma, { emit: jest.fn() } as never);
      await service.rollStorms("w1", seed);
      expect(ships[0].hull).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("EventService.rollFestivals / expireFestivals", () => {
  it("does nothing off the festival interval", async () => {
    const { prisma, worldEvents } = makePrisma();
    const service = new EventService(prisma, { emit: jest.fn() } as never);
    await service.rollFestivals("w1", BALANCE.FESTIVAL_INTERVAL_TICKS - 1);
    expect(worldEvents).toHaveLength(0);
  });

  it("boosts prosperity at the chosen port on the scheduled tick", async () => {
    const { prisma, portStates, worldEvents } = makePrisma();
    const service = new EventService(prisma, { emit: jest.fn() } as never);
    await service.rollFestivals("w1", BALANCE.FESTIVAL_INTERVAL_TICKS);
    expect(worldEvents).toHaveLength(1);
    expect(worldEvents[0].type).toBe("FESTIVAL");
    expect(portStates["port.amber_gulf.aurelia"].prosperity).toBeGreaterThanOrEqual(70);
  });

  it("reverts the prosperity boost once the festival expires", async () => {
    const { prisma, portStates, worldEvents } = makePrisma();
    const service = new EventService(prisma, { emit: jest.fn() } as never);
    await service.rollFestivals("w1", BALANCE.FESTIVAL_INTERVAL_TICKS);
    const boosted = portStates["port.amber_gulf.aurelia"].prosperity;

    await service.expireFestivals("w1", BALANCE.FESTIVAL_INTERVAL_TICKS + BALANCE.FESTIVAL_DURATION_TICKS);

    expect(portStates["port.amber_gulf.aurelia"].prosperity).toBeLessThan(boosted);
    expect(worldEvents[0].status).toBe("EXPIRED");
  });
});
