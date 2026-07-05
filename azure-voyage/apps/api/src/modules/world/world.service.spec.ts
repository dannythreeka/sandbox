import { BALANCE, CONTENT_VERSION } from "@azure-voyage/shared";
import type { GameWorld } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { WorldService } from "./world.service";

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
