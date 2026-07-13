import { BALANCE, CONTENT_VERSION } from "@azure-voyage/shared";
import type { GameWorld } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { WorldService } from "./world.service";

interface FleetRow {
  id: string;
  worldId: string;
  guildId: string;
  name: string;
  activity: "DOCKED" | "SAILING" | "ANCHORED" | "EXPLORING" | "IN_BATTLE";
  posQ: number;
  posR: number;
  dockedPortId: string | null;
  food: number;
  water: number;
  morale: number;
}

interface OfficerRow {
  id: string;
  worldId: string;
  fleetId: string | null;
  locationPortId: string | null;
  name: string;
  portrait: string;
  role: string | null;
  stats: { lead: number; nav: number; combat: number; trade: number; lore: number };
  skills: string[];
  loyalty: number;
  salary: number;
  persona: null;
}

function worldRow(overrides: Partial<GameWorld> = {}): GameWorld {
  return {
    id: "w1",
    userId: "u1",
    name: "初航",
    difficulty: "NORMAL",
    contentVersion: CONTENT_VERSION,
    seed: 42,
    currentTick: 0,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GameWorld;
}

interface PrismaMockState {
  worlds: GameWorld[];
  activeCount: number;
}

function makePrismaMock(state: Partial<PrismaMockState> = {}) {
  const worlds = state.worlds ?? [];
  const prisma = {
    gameWorld: {
      count: jest.fn(async () => state.activeCount ?? 0),
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) =>
        worlds.filter((w) => w.userId === where.userId && w.status !== "ABANDONED"),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        worlds.find((w) => w.id === where.id) ?? null,
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<GameWorld> }) => {
          const world = worlds.find((w) => w.id === where.id)!;
          Object.assign(world, data);
          return world;
        },
      ),
    },
    user: {
      findUniqueOrThrow: jest.fn(async () => ({
        id: "u1",
        email: "a@example.com",
        displayName: "提督A",
      })),
    },
    // 單元測試不驗證持久化細節（由 runtime 驗收腳本覆蓋），僅驗證 create 的編排
    $transaction: jest.fn(async () => worldRow()),
  } as unknown as PrismaService;
  return { prisma, worlds };
}

describe("WorldService", () => {
  it("creates a world through a transaction and returns its summary", async () => {
    const { prisma } = makePrismaMock();
    const service = new WorldService(prisma);

    const summary = await service.create("u1", { name: "初航", difficulty: "NORMAL" });

    expect(summary.contentVersion).toBe(CONTENT_VERSION);
    expect(summary.status).toBe("ACTIVE");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("enforces the active-world limit before generating anything", async () => {
    const { prisma } = makePrismaMock({ activeCount: BALANCE.MAX_ACTIVE_WORLDS_PER_USER });
    const service = new WorldService(prisma);

    await expect(
      service.create("u1", { name: "再一個", difficulty: "EASY" }),
    ).rejects.toMatchObject({ code: "WORLD_LIMIT_REACHED" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("hides other users' worlds behind NOT_FOUND", async () => {
    const { prisma } = makePrismaMock({ worlds: [worldRow({ userId: "someone-else" })] });
    const service = new WorldService(prisma);

    await expect(service.getSnapshot("u1", "w1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("abandons a world (soft delete) and excludes it from listing", async () => {
    const { prisma } = makePrismaMock({ worlds: [worldRow()] });
    const service = new WorldService(prisma);

    const abandoned = await service.abandon("u1", "w1");
    expect(abandoned.status).toBe("ABANDONED");
    await expect(service.list("u1")).resolves.toHaveLength(0);
  });
});

// M21 縮編後既有存檔可能還有艦隊/待業航海士停在已刪除的港口 id（如 port.amber_gulf.vireno）；
// getSnapshot() 讀取時要自我修復成最近的存續港口，而不是讓 portById() 崩潰。
describe("WorldService#getSnapshot self-heal for removed port ids", () => {
  function makeSnapshotPrismaMock(
    fleet: FleetRow,
    tavernOfficers: OfficerRow[],
    battles: { id: string; fleetId: string }[] = [],
  ) {
    const fleets = [fleet];
    const officers = [...tavernOfficers];
    const prisma = {
      gameWorld: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          where.id === "w1" ? worldRow({ id: "w1", userId: "u1" }) : null,
        ),
      },
      guild: {
        findMany: jest.fn(async () => [
          {
            id: "g-player",
            worldId: "w1",
            kind: "PLAYER",
            name: "玩家商會",
            gold: BigInt(1000),
            fame: 0,
            captainExp: 0,
            captainLead: 20,
            captainNav: 20,
            captainCombat: 20,
            captainTrade: 20,
            captainLore: 20,
          },
        ]),
      },
      fleet: {
        findMany: jest.fn(async () => fleets.map((f) => ({ ...f, ships: [], officers: [] }))),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<FleetRow> }) => {
          const f = fleets.find((x) => x.id === where.id)!;
          Object.assign(f, data);
          return f;
        }),
      },
      officer: {
        findMany: jest.fn(async () => officers.map((o) => ({ ...o }))),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<OfficerRow> }) => {
          const o = officers.find((x) => x.id === where.id)!;
          Object.assign(o, data);
          return o;
        }),
      },
      portInfluence: { findMany: jest.fn(async () => []) },
      discoveryRecord: { count: jest.fn(async () => 0) },
      battle: { findMany: jest.fn(async () => battles) },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === "function") return arg(prisma);
        return Promise.all(arg as Promise<unknown>[]);
      }),
    } as unknown as PrismaService;
    return { prisma, fleets, officers };
  }

  it("relocates a fleet docked at a removed port to the nearest surviving port", async () => {
    const fleet: FleetRow = {
      id: "f1",
      worldId: "w1",
      guildId: "g-player",
      name: "第一艦隊",
      activity: "DOCKED",
      posQ: 0,
      posR: 0,
      dockedPortId: "port.amber_gulf.vireno", // M21 刪除的港口（維雷諾）
      food: 10,
      water: 10,
      morale: 100,
    };
    const { prisma, fleets } = makeSnapshotPrismaMock(fleet, []);
    const service = new WorldService(prisma);

    const snapshot = await service.getSnapshot("u1", "w1");

    expect(snapshot.fleets[0].dockedPortId).toBe("port.amber_gulf.perlan");
    expect(fleets[0].dockedPortId).toBe("port.amber_gulf.perlan"); // 已寫回 DB
    expect(prisma.fleet.update).toHaveBeenCalledTimes(1);
  });

  it("relocates a tavern officer stranded at a removed port", async () => {
    const fleet: FleetRow = {
      id: "f1",
      worldId: "w1",
      guildId: "g-player",
      name: "第一艦隊",
      activity: "DOCKED",
      posQ: 0,
      posR: 0,
      dockedPortId: "port.amber_gulf.aurelia",
      food: 10,
      water: 10,
      morale: 100,
    };
    const officer: OfficerRow = {
      id: "o1",
      worldId: "w1",
      fleetId: null,
      locationPortId: "port.silkwind.mashqet", // M21 刪除的港口（瑪什凱）
      name: "待業航海士",
      portrait: "p.png",
      role: null,
      stats: { lead: 10, nav: 10, combat: 10, trade: 10, lore: 10 },
      skills: [],
      loyalty: 100,
      salary: 10,
      persona: null,
    };
    const { prisma, officers } = makeSnapshotPrismaMock(fleet, [officer]);
    const service = new WorldService(prisma);

    await service.getSnapshot("u1", "w1");

    expect(officers[0].locationPortId).toBe("port.silkwind.qeshvar");
    expect(prisma.officer.update).toHaveBeenCalledTimes(1);
  });

  it("leaves fleets docked at surviving ports untouched", async () => {
    const fleet: FleetRow = {
      id: "f1",
      worldId: "w1",
      guildId: "g-player",
      name: "第一艦隊",
      activity: "DOCKED",
      posQ: 0,
      posR: 0,
      dockedPortId: "port.amber_gulf.aurelia",
      food: 10,
      water: 10,
      morale: 100,
    };
    const { prisma } = makeSnapshotPrismaMock(fleet, []);
    const service = new WorldService(prisma);

    const snapshot = await service.getSnapshot("u1", "w1");

    expect(snapshot.fleets[0].dockedPortId).toBe("port.amber_gulf.aurelia");
    expect(prisma.fleet.update).not.toHaveBeenCalled();
  });

  // bug 修復：重新連線時要能知道艦隊卡在哪一場進行中的海戰裡，前端才能接回戰鬥畫面
  // 而不是永遠卡在 IN_BATTLE 卻看不到任何戰鬥介面。
  it("surfaces activeBattleId when the fleet is in an ongoing battle", async () => {
    const fleet: FleetRow = {
      id: "f1",
      worldId: "w1",
      guildId: "g-player",
      name: "第一艦隊",
      activity: "IN_BATTLE",
      posQ: 0,
      posR: 0,
      dockedPortId: null,
      food: 10,
      water: 10,
      morale: 100,
    };
    const { prisma } = makeSnapshotPrismaMock(fleet, [], [{ id: "battle1", fleetId: "f1" }]);
    const service = new WorldService(prisma);

    const snapshot = await service.getSnapshot("u1", "w1");

    expect(snapshot.fleets[0].activeBattleId).toBe("battle1");
  });

  it("leaves activeBattleId null when there is no ongoing battle for the fleet", async () => {
    const fleet: FleetRow = {
      id: "f1",
      worldId: "w1",
      guildId: "g-player",
      name: "第一艦隊",
      activity: "DOCKED",
      posQ: 0,
      posR: 0,
      dockedPortId: "port.amber_gulf.aurelia",
      food: 10,
      water: 10,
      morale: 100,
    };
    const { prisma } = makeSnapshotPrismaMock(fleet, []);
    const service = new WorldService(prisma);

    const snapshot = await service.getSnapshot("u1", "w1");

    expect(snapshot.fleets[0].activeBattleId).toBeNull();
  });
});
