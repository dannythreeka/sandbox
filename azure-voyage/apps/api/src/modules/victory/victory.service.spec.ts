import { EventEmitter2 } from "@nestjs/event-emitter";
import { BALANCE, victoryAssetTarget } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { VictoryService, WORLD_VICTORY_EVENT } from "./victory.service";

const NORTH_REACH_PORTS = [
  "port.north_reach.frosthaven",
  "port.north_reach.seskar",
  "port.north_reach.valdren",
  "port.north_reach.eldmoor",
];
const AMBER_GULF_PORTS = [
  "port.amber_gulf.aurelia",
  "port.amber_gulf.mirenport",
  "port.amber_gulf.castellan",
  "port.amber_gulf.solmere",
];
const IRONCLIFF_PORTS = ["port.ironcliff.durnhal", "port.ironcliff.krag"];
const DUSK_EXPANSE_PORTS = ["port.dusk.umbralis", "port.dusk.nyrvana"];

interface InfluenceRow {
  portId: string;
  guildId: string;
  share: number;
}

function makePrisma(opts: {
  status?: string;
  gold?: number;
  influenceRows: InfluenceRow[];
  ships?: { shipClassId: string }[];
  relicsRegistered?: number;
}) {
  const world = { id: "w1", status: opts.status ?? "ACTIVE", difficulty: "NORMAL" };
  const playerGuild = { id: "g-player", worldId: "w1", kind: "PLAYER", gold: BigInt(opts.gold ?? 0) };

  const updateSpy = jest.fn(async ({ data }: { data: { status: string } }) => {
    Object.assign(world, data);
    return world;
  });

  const prisma = {
    gameWorld: {
      findUniqueOrThrow: jest.fn(async () => world),
      update: updateSpy,
    },
    guild: {
      findFirstOrThrow: jest.fn(async () => playerGuild),
    },
    portInfluence: {
      findMany: jest.fn(async () =>
        opts.influenceRows.map((r) => ({
          guildId: r.guildId,
          share: r.share,
          portState: { portId: r.portId },
        })),
      ),
    },
    ship: {
      findMany: jest.fn(async () => opts.ships ?? []),
    },
    discoveryRecord: {
      count: jest.fn(async () => opts.relicsRegistered ?? 0),
    },
  } as unknown as PrismaService;

  return { prisma, world, playerGuild, updateSpy };
}

function shipRow(shipClassId: string) {
  return { shipClassId };
}

describe("VictoryService.checkVictory", () => {
  it("does nothing when no victory condition is met", async () => {
    const { prisma, world, updateSpy } = makePrisma({
      gold: 100,
      influenceRows: NORTH_REACH_PORTS.map((p) => ({ portId: p, guildId: "g-player", share: 10 })),
    });
    const events = new EventEmitter2();
    const emitSpy = jest.spyOn(events, "emit");
    const service = new VictoryService(prisma, events);

    await service.checkVictory("w1", 42);

    expect(world.status).toBe("ACTIVE");
    expect(updateSpy).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("skips worlds that are no longer ACTIVE", async () => {
    const { prisma, updateSpy } = makePrisma({
      status: "VICTORY",
      influenceRows: [],
    });
    const events = new EventEmitter2();
    const service = new VictoryService(prisma, events);

    await service.checkVictory("w1", 42);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("declares REGION_DOMINANCE victory once enough regions are dominated", async () => {
    const share = BALANCE.REGION_DOMINANCE_SHARE + 10;
    const rows: InfluenceRow[] = [
      ...NORTH_REACH_PORTS,
      ...AMBER_GULF_PORTS,
      ...IRONCLIFF_PORTS,
      ...DUSK_EXPANSE_PORTS,
    ].map((p) => ({ portId: p, guildId: "g-player", share }));
    const { prisma, world, updateSpy } = makePrisma({ gold: 0, influenceRows: rows });
    const events = new EventEmitter2();
    const emitSpy = jest.spyOn(events, "emit");
    const service = new VictoryService(prisma, events);

    await service.checkVictory("w1", 99);

    expect(world.status).toBe("VICTORY");
    expect(updateSpy).toHaveBeenCalledWith({ where: { id: "w1" }, data: { status: "VICTORY" } });
    expect(emitSpy).toHaveBeenCalledWith(
      WORLD_VICTORY_EVENT,
      expect.objectContaining({
        worldId: "w1",
        payload: expect.objectContaining({ reason: "REGION_DOMINANCE", tick: 99 }),
      }),
    );
  });

  it("declares ASSET_TARGET victory once gold + ship value reaches the difficulty target", async () => {
    const target = victoryAssetTarget("NORMAL");
    const { prisma, world } = makePrisma({
      gold: target,
      influenceRows: [],
      ships: [],
    });
    const events = new EventEmitter2();
    const emitSpy = jest.spyOn(events, "emit");
    const service = new VictoryService(prisma, events);

    await service.checkVictory("w1", 7);

    expect(world.status).toBe("VICTORY");
    expect(emitSpy).toHaveBeenCalledWith(
      WORLD_VICTORY_EVENT,
      expect.objectContaining({ payload: expect.objectContaining({ reason: "ASSET_TARGET" }) }),
    );
  });

  it("counts ship value toward the asset target", async () => {
    const target = victoryAssetTarget("NORMAL");
    const shipPrice = 210_000; // ship.galleon
    const { prisma: shortOfTarget, world: w1 } = makePrisma({
      gold: 0,
      influenceRows: [],
      ships: [shipRow("ship.galleon")],
    });
    await new VictoryService(shortOfTarget, new EventEmitter2()).checkVictory("w1", 1);
    expect(w1.status).toBe("ACTIVE"); // 單靠一艘船的估值不足以達標

    const { prisma: overTarget, world: w2 } = makePrisma({
      gold: Math.max(0, target - shipPrice),
      influenceRows: [],
      ships: [shipRow("ship.galleon")],
    });
    await new VictoryService(overTarget, new EventEmitter2()).checkVictory("w1", 1);
    expect(w2.status).toBe("VICTORY"); // 金幣 + 船價合計達標
  });

  it("declares RELIC_COLLECTOR victory once enough S-rarity discoveries are registered", async () => {
    const { prisma, world } = makePrisma({
      gold: 0,
      influenceRows: [],
      ships: [],
      relicsRegistered: BALANCE.VICTORY_RELICS_REQUIRED,
    });
    const events = new EventEmitter2();
    const emitSpy = jest.spyOn(events, "emit");
    const service = new VictoryService(prisma, events);

    await service.checkVictory("w1", 3);

    expect(world.status).toBe("VICTORY");
    expect(emitSpy).toHaveBeenCalledWith(
      WORLD_VICTORY_EVENT,
      expect.objectContaining({ payload: expect.objectContaining({ reason: "RELIC_COLLECTOR" }) }),
    );
  });

  it("does not declare RELIC_COLLECTOR victory below the threshold", async () => {
    const { prisma, world } = makePrisma({
      gold: 0,
      influenceRows: [],
      ships: [],
      relicsRegistered: BALANCE.VICTORY_RELICS_REQUIRED - 1,
    });
    const service = new VictoryService(prisma, new EventEmitter2());

    await service.checkVictory("w1", 3);

    expect(world.status).toBe("ACTIVE");
  });
});
