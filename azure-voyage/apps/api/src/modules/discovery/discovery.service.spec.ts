import { DISCOVERIES, oddrToAxial } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import type { DiscoveryNarrativeService } from "../ai/discovery-narrative.service";
import { DiscoveryService } from "./discovery.service";

const SITE = DISCOVERIES[0]; // disc.the_glass_reef, requiredLore 40
const SITE_AXIAL = oddrToAxial(SITE.coord);

function makeNarrativeService() {
  return { generate: jest.fn(async () => "測試敘事文本") } as unknown as DiscoveryNarrativeService;
}

function makePrisma(overrides: { fleetActivity?: string; lore?: number; alreadyFound?: string[] } = {}) {
  const world = { id: "w1", userId: "u1", currentTick: 10, seed: 777 };
  const fleet = {
    id: "f1",
    worldId: "w1",
    guildId: "g1",
    activity: overrides.fleetActivity ?? "ANCHORED",
    posQ: SITE_AXIAL.q,
    posR: SITE_AXIAL.r,
    food: 20,
    water: 20,
    guild: { kind: "PLAYER" },
    officers: [{ stats: { lore: overrides.lore ?? 90 } }],
  };
  const discoveryRecords: {
    id: string;
    worldId: string;
    discoveryId: string;
    registered: boolean;
    narrative: string | null;
  }[] = (overrides.alreadyFound ?? []).map((id, i) => ({
    id: `dr${i}`,
    worldId: "w1",
    discoveryId: id,
    registered: false,
    narrative: null,
  }));
  const guild = {
    id: "g1",
    worldId: "w1",
    kind: "PLAYER",
    gold: 1000n,
    fame: 0,
    captainExp: 0,
    captainLead: 20,
    captainNav: 20,
    captainCombat: 20,
    captainTrade: 20,
    captainLore: 20,
  };

  const prisma = {
    gameWorld: { findUnique: jest.fn(async () => world) },
    fleet: {
      findUnique: jest.fn(async () => fleet),
      update: jest.fn(async ({ data }: { data: Partial<typeof fleet> }) => Object.assign(fleet, data)),
    },
    discoveryRecord: {
      findMany: jest.fn(async () => discoveryRecords),
      create: jest.fn(async ({ data }: { data: { discoveryId: string; foundTick: number } }) => {
        const record = { id: `dr${discoveryRecords.length}`, worldId: "w1", registered: false, narrative: null, ...data };
        discoveryRecords.push(record);
        return record;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        discoveryRecords.find((d) => d.id === where.id) ?? null,
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<{ registered: boolean; narrative: string }>;
        }) => {
          Object.assign(discoveryRecords.find((d) => d.id === where.id)!, data);
        },
      ),
    },
    guild: {
      findFirstOrThrow: jest.fn(async () => guild),
      findUniqueOrThrow: jest.fn(async () => guild),
      update: jest.fn(
        async ({
          data,
        }: {
          data: Partial<typeof guild> & { gold?: bigint; fame?: { increment: number } };
        }) => {
          const { fame, ...rest } = data;
          if (fame !== undefined) guild.fame += fame.increment;
          Object.assign(guild, rest);
        },
      ),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  return { prisma, discoveryRecords, guild, fleet };
}

describe("DiscoveryService.explore", () => {
  it("rejects exploring when the fleet is not anchored", async () => {
    const { prisma } = makePrisma({ fleetActivity: "SAILING" });
    const service = new DiscoveryService(prisma, makeNarrativeService());
    await expect(service.explore("u1", "w1", "f1")).rejects.toMatchObject({ code: "FLEET_BUSY" });
  });

  it("rejects exploring when not near any undiscovered site", async () => {
    const { prisma, fleet } = makePrisma();
    fleet.posQ = 0;
    fleet.posR = 0; // 遠離任何發現物
    const service = new DiscoveryService(prisma, makeNarrativeService());
    await expect(service.explore("u1", "w1", "f1")).rejects.toMatchObject({
      code: "NOT_NEAR_DISCOVERY_SITE",
    });
  });

  it("consumes supplies regardless of outcome", async () => {
    const { prisma, fleet } = makePrisma();
    const service = new DiscoveryService(prisma, makeNarrativeService());
    await service.explore("u1", "w1", "f1");
    expect(fleet.food).toBeLessThan(20);
    expect(fleet.water).toBeLessThan(20);
  });

  it("high lore reliably succeeds and creates a discovery record", async () => {
    const { prisma, discoveryRecords } = makePrisma({ lore: 95 }); // 遠高於門檻 40
    const service = new DiscoveryService(prisma, makeNarrativeService());
    const result = await service.explore("u1", "w1", "f1");
    expect(result.success).toBe(true);
    expect(discoveryRecords).toHaveLength(1);
    expect(discoveryRecords[0].discoveryId).toBe(SITE.id);
  });

  it("does not re-discover an already-found site", async () => {
    const { prisma } = makePrisma({ alreadyFound: [SITE.id] });
    const service = new DiscoveryService(prisma, makeNarrativeService());
    // 唯一鄰近點已經被找過，附近沒有其他未探索點
    await expect(service.explore("u1", "w1", "f1")).rejects.toMatchObject({
      code: "NOT_NEAR_DISCOVERY_SITE",
    });
  });
});

describe("DiscoveryService.registerDiscovery", () => {
  it("rejects a port too small to have a guild hall", async () => {
    const { prisma } = makePrisma();
    const service = new DiscoveryService(prisma, makeNarrativeService());
    // port.dusk.nyrvana size 1 < GUILD_HALL_MIN_PORT_SIZE(2)
    await expect(
      service.registerDiscovery("u1", "w1", "port.dusk.nyrvana", "dr0"),
    ).rejects.toMatchObject({ code: "NO_GUILD_HALL" });
  });

  it("registers a found discovery and pays out gold/fame", async () => {
    const { prisma, discoveryRecords, guild } = makePrisma({ lore: 95 });
    const service = new DiscoveryService(prisma, makeNarrativeService());
    await service.explore("u1", "w1", "f1");

    const result = await service.registerDiscovery(
      "u1",
      "w1",
      "port.amber_gulf.aurelia", // size 3
      discoveryRecords[0].id,
    );

    expect(result.goldReward).toBe(SITE.goldReward);
    expect(Number(guild.gold)).toBe(1000 + SITE.goldReward);
    expect(guild.fame).toBe(SITE.fameReward);
    expect(discoveryRecords[0].registered).toBe(true);
  });

  it("rejects registering the same discovery twice", async () => {
    const { prisma, discoveryRecords } = makePrisma({ lore: 95 });
    const service = new DiscoveryService(prisma, makeNarrativeService());
    await service.explore("u1", "w1", "f1");
    await service.registerDiscovery("u1", "w1", "port.amber_gulf.aurelia", discoveryRecords[0].id);

    await expect(
      service.registerDiscovery("u1", "w1", "port.amber_gulf.aurelia", discoveryRecords[0].id),
    ).rejects.toMatchObject({ code: "DISCOVERY_ALREADY_REGISTERED" });
  });
});
