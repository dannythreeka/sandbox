import { EventEmitter2 } from "@nestjs/event-emitter";
import { QUEST_CHAPTERS } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { QuestService, WORLD_QUEST_CHAPTER_EVENT } from "./quest.service";

interface Fixture {
  questChapter?: number;
  worldStatus?: string;
  gold?: number;
  goodwillRows?: number[];
  officerCount?: number;
  battleWins?: number;
  shareRows?: number[];
  ships?: { shipClassId: string }[];
}

function makePrisma(opts: Fixture) {
  const world = { id: "w1", status: opts.worldStatus ?? "ACTIVE", questChapter: opts.questChapter ?? 0 };
  const guild = { id: "g-player", worldId: "w1", kind: "PLAYER", gold: BigInt(opts.gold ?? 0), fame: 0 };
  const fleet = { id: "f1", worldId: "w1", guildId: "g-player" };

  const worldUpdateSpy = jest.fn(async ({ data }: { data: { questChapter: number } }) => {
    Object.assign(world, data);
    return world;
  });
  const guildUpdateSpy = jest.fn(
    async ({ data }: { data: { gold: bigint; fame: { increment: number } } }) => {
      guild.gold = data.gold;
      guild.fame += data.fame.increment;
      return guild;
    },
  );

  const prisma = {
    gameWorld: {
      findUniqueOrThrow: jest.fn(async () => world),
      update: worldUpdateSpy,
    },
    guild: {
      findFirstOrThrow: jest.fn(async () => guild),
      update: guildUpdateSpy,
    },
    portInfluence: {
      findMany: jest.fn(async ({ select }: { select: { goodwill?: true; share?: true } }) => {
        if (select.goodwill) return (opts.goodwillRows ?? []).map((goodwill) => ({ goodwill }));
        return (opts.shareRows ?? []).map((share) => ({ share }));
      }),
    },
    officer: {
      count: jest.fn(async () => opts.officerCount ?? 0),
    },
    fleet: {
      findFirst: jest.fn(async () => fleet),
    },
    battle: {
      count: jest.fn(async () => opts.battleWins ?? 0),
    },
    ship: {
      findMany: jest.fn(async () => opts.ships ?? []),
    },
  } as unknown as PrismaService;

  return { prisma, world, guild, worldUpdateSpy, guildUpdateSpy };
}

describe("QuestService.checkProgress", () => {
  it("does nothing once all chapters are already completed", async () => {
    const { prisma, worldUpdateSpy } = makePrisma({ questChapter: QUEST_CHAPTERS.length });
    const events = new EventEmitter2();
    const emitSpy = jest.spyOn(events, "emit");
    const service = new QuestService(prisma, events);

    await service.checkProgress("w1", 10);

    expect(worldUpdateSpy).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("ch1: stays put until the player has completed at least one trade (goodwill > 0)", async () => {
    const { prisma, world } = makePrisma({ questChapter: 0, goodwillRows: [0, 0] });
    const service = new QuestService(prisma, new EventEmitter2());

    await service.checkProgress("w1", 1);
    expect(world.questChapter).toBe(0);
  });

  it("ch1: advances and pays rewards once goodwill is positive somewhere", async () => {
    const { prisma, world, guild, worldUpdateSpy, guildUpdateSpy } = makePrisma({
      questChapter: 0,
      gold: 1000,
      goodwillRows: [0, 5],
    });
    const events = new EventEmitter2();
    const emitSpy = jest.spyOn(events, "emit");
    const service = new QuestService(prisma, events);

    await service.checkProgress("w1", 5);

    expect(world.questChapter).toBe(1);
    expect(worldUpdateSpy).toHaveBeenCalledWith({ where: { id: "w1" }, data: { questChapter: 1 } });
    expect(Number(guild.gold)).toBe(1000 + QUEST_CHAPTERS[0].goldReward);
    expect(guildUpdateSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      WORLD_QUEST_CHAPTER_EVENT,
      expect.objectContaining({
        worldId: "w1",
        payload: expect.objectContaining({ chapterId: "ch1", tick: 5 }),
      }),
    );
  });

  it("ch2: requires at least 2 recruited officers", async () => {
    const short = makePrisma({ questChapter: 1, officerCount: 1 });
    await new QuestService(short.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(short.world.questChapter).toBe(1);

    const enough = makePrisma({ questChapter: 1, officerCount: 2 });
    await new QuestService(enough.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(enough.world.questChapter).toBe(2);
  });

  it("ch3: requires winning at least one battle", async () => {
    const noWin = makePrisma({ questChapter: 2, battleWins: 0 });
    await new QuestService(noWin.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(noWin.world.questChapter).toBe(2);

    const won = makePrisma({ questChapter: 2, battleWins: 1 });
    await new QuestService(won.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(won.world.questChapter).toBe(3);
  });

  it("ch4: requires 20%+ influence share at some port", async () => {
    const short = makePrisma({ questChapter: 3, shareRows: [10, 15] });
    await new QuestService(short.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(short.world.questChapter).toBe(3);

    const enough = makePrisma({ questChapter: 3, shareRows: [10, 25] });
    await new QuestService(enough.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(enough.world.questChapter).toBe(4);
  });

  it("ch5: requires total assets (gold + ship value) to reach 100,000", async () => {
    const short = makePrisma({ questChapter: 4, gold: 50_000, ships: [] });
    await new QuestService(short.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(short.world.questChapter).toBe(4);

    const enough = makePrisma({ questChapter: 4, gold: 100_000, ships: [] });
    await new QuestService(enough.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(enough.world.questChapter).toBe(5);
  });

  it("ch6: requires the world to have reached VICTORY", async () => {
    const active = makePrisma({ questChapter: 5, worldStatus: "ACTIVE" });
    await new QuestService(active.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(active.world.questChapter).toBe(5);

    const victorious = makePrisma({ questChapter: 5, worldStatus: "VICTORY" });
    await new QuestService(victorious.prisma, new EventEmitter2()).checkProgress("w1", 1);
    expect(victorious.world.questChapter).toBe(6);
  });
});
