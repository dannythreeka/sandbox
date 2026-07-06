import type { PrismaService } from "../../prisma/prisma.service";
import { InfluenceService } from "./influence.service";

const PORT_ID = "port.amber_gulf.aurelia";

function makePrisma(opts: {
  worldUserId?: string;
  gold?: number;
  existingShare?: number;
  influences?: { guildId: string; share: number; goodwill: number; guildKind: string }[];
}) {
  const world = { id: "w1", userId: opts.worldUserId ?? "u1" };
  const guild = { id: "g1", worldId: "w1", kind: "PLAYER", gold: BigInt(opts.gold ?? 0) };
  const portState = { id: "ps1", worldId: "w1", portId: PORT_ID };
  const influenceStore = new Map<string, { share: number; goodwill: number }>();
  if (opts.existingShare !== undefined) {
    influenceStore.set("g1", { share: opts.existingShare, goodwill: 0 });
  }

  const prisma = {
    gameWorld: { findUnique: jest.fn(async () => world) },
    guild: {
      findFirstOrThrow: jest.fn(async () => guild),
      findUniqueOrThrow: jest.fn(async () => guild),
      update: jest.fn(async ({ data }: { data: { gold: bigint } }) => {
        guild.gold = data.gold;
        return guild;
      }),
    },
    portState: {
      findUniqueOrThrow: jest.fn(async () => portState),
      findMany: jest.fn(async () => [
        {
          ...portState,
          influences: (opts.influences ?? []).map((i) => ({
            guildId: i.guildId,
            share: i.share,
            goodwill: i.goodwill,
            guild: { kind: i.guildKind },
          })),
        },
      ]),
    },
    portInfluence: {
      findUnique: jest.fn(async () => {
        const existing = influenceStore.get("g1");
        return existing ? { share: existing.share, goodwill: existing.goodwill } : null;
      }),
      upsert: jest.fn(async ({ create, update }: { create: { share: number }; update: { share: number } }) => {
        const wasExisting = influenceStore.has("g1");
        influenceStore.set("g1", {
          share: wasExisting ? update.share : create.share,
          goodwill: 0,
        });
        return influenceStore.get("g1");
      }),
      update: jest.fn(async () => undefined),
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
  } as unknown as PrismaService;

  return { prisma, guild, influenceStore };
}

describe("InfluenceService.invest", () => {
  it("rejects when the world belongs to another user", async () => {
    const { prisma } = makePrisma({ worldUserId: "someone-else", gold: 1000 });
    const service = new InfluenceService(prisma);

    await expect(service.invest("u1", "w1", PORT_ID, 100)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects when the player guild cannot afford the investment", async () => {
    const { prisma } = makePrisma({ gold: 50 });
    const service = new InfluenceService(prisma);

    await expect(service.invest("u1", "w1", PORT_ID, 100)).rejects.toMatchObject({
      code: "INSUFFICIENT_GOLD",
    });
  });

  it("deducts gold and grants a share for a first-time investment", async () => {
    const { prisma, guild, influenceStore } = makePrisma({ gold: 1000 });
    const service = new InfluenceService(prisma);

    const { gain } = await service.invest("u1", "w1", PORT_ID, 400);

    expect(gain).toBeGreaterThan(0);
    expect(Number(guild.gold)).toBe(600);
    expect(influenceStore.get("g1")?.share).toBeCloseTo(gain);
  });

  it("accumulates onto an existing share with diminishing returns", async () => {
    const { prisma, influenceStore } = makePrisma({ gold: 1000, existingShare: 20 });
    const service = new InfluenceService(prisma);

    const { gain } = await service.invest("u1", "w1", PORT_ID, 400);

    expect(influenceStore.get("g1")?.share).toBeCloseTo(20 + gain);
  });
});

describe("InfluenceService.investAsGuild", () => {
  it("silently no-ops when the guild cannot afford the amount (NPC path)", async () => {
    const { prisma, guild } = makePrisma({ gold: 10 });
    const service = new InfluenceService(prisma);

    const result = await service.investAsGuild("w1", "g1", PORT_ID, 100);

    expect(result).toEqual({ gain: 0 });
    expect(Number(guild.gold)).toBe(10);
  });
});

describe("InfluenceService.settleAllPorts", () => {
  it("skips ports with no influence rows", async () => {
    const { prisma } = makePrisma({ influences: [] });
    const service = new InfluenceService(prisma);

    await expect(service.settleAllPorts("w1")).resolves.toBeUndefined();
    expect((prisma.$transaction as jest.Mock).mock.calls.length).toBe(0);
  });

  it("runs settleInfluence and persists the settled shares", async () => {
    const { prisma } = makePrisma({
      influences: [
        { guildId: "g1", share: 30, goodwill: 10, guildKind: "PLAYER" },
        { guildId: "local", share: 20, goodwill: 0, guildKind: "LOCAL" },
      ],
    });
    const service = new InfluenceService(prisma);

    await service.settleAllPorts("w1");

    expect(prisma.portInfluence.update).toHaveBeenCalledTimes(2);
  });
});
