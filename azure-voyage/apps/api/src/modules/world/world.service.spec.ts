import { CONTENT_VERSION, MAX_ACTIVE_WORLDS_PER_USER } from "@azure-voyage/shared";
import type { GameWorld } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { WorldService } from "./world.service";

function makePrismaMock(rows: GameWorld[] = []) {
  const worlds = [...rows];
  const prisma = {
    gameWorld: {
      count: jest.fn(async ({ where }: { where: { userId: string; status: string } }) => {
        return worlds.filter((w) => w.userId === where.userId && w.status === where.status)
          .length;
      }),
      create: jest.fn(async ({ data }: { data: Partial<GameWorld> }) => {
        const world = {
          id: `w${worlds.length + 1}`,
          currentTick: 0,
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        } as GameWorld;
        worlds.push(world);
        return world;
      }),
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) => {
        return worlds.filter((w) => w.userId === where.userId && w.status !== "ABANDONED");
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return worlds.find((w) => w.id === where.id) ?? null;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<GameWorld> }) => {
          const world = worlds.find((w) => w.id === where.id);
          if (!world) throw new Error("not found");
          Object.assign(world, data);
          return world;
        },
      ),
    },
  } as unknown as PrismaService;
  return { prisma, worlds };
}

function worldRow(overrides: Partial<GameWorld>): GameWorld {
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

describe("WorldService", () => {
  it("creates a world with seed and content version", async () => {
    const { prisma } = makePrismaMock();
    const service = new WorldService(prisma);

    const summary = await service.create("u1", { name: "初航", difficulty: "NORMAL" });

    expect(summary.contentVersion).toBe(CONTENT_VERSION);
    expect(summary.status).toBe("ACTIVE");
    expect(summary.currentTick).toBe(0);
  });

  it("enforces the active-world limit", async () => {
    const rows = Array.from({ length: MAX_ACTIVE_WORLDS_PER_USER }, (_, i) =>
      worldRow({ id: `w${i}` }),
    );
    const { prisma } = makePrismaMock(rows);
    const service = new WorldService(prisma);

    await expect(
      service.create("u1", { name: "再一個", difficulty: "EASY" }),
    ).rejects.toMatchObject({ code: "WORLD_LIMIT_REACHED" });
  });

  it("hides other users' worlds behind NOT_FOUND", async () => {
    const { prisma } = makePrismaMock([worldRow({ userId: "someone-else" })]);
    const service = new WorldService(prisma);

    await expect(service.getSnapshot("u1", "w1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("abandons a world (soft delete) and excludes it from listing", async () => {
    const { prisma } = makePrismaMock([worldRow({})]);
    const service = new WorldService(prisma);

    const abandoned = await service.abandon("u1", "w1");
    expect(abandoned.status).toBe("ABANDONED");
    await expect(service.list("u1")).resolves.toHaveLength(0);
  });
});
