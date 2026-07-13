import { EventEmitter2 } from "@nestjs/event-emitter";
import { BALANCE } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { DefeatService, WORLD_DEFEAT_EVENT } from "./defeat.service";

function makePrisma(opts: { status?: string; gold?: number; shipCount?: number; bankruptTicks?: number }) {
  const world = {
    id: "w1",
    status: opts.status ?? "ACTIVE",
    bankruptTicks: opts.bankruptTicks ?? 0,
  };
  const guild = { id: "g-player", worldId: "w1", kind: "PLAYER", gold: BigInt(opts.gold ?? 10000) };

  const worldUpdateSpy = jest.fn(async ({ data }: { data: Partial<typeof world> }) => {
    Object.assign(world, data);
    return world;
  });

  const prisma = {
    gameWorld: {
      findUniqueOrThrow: jest.fn(async () => world),
      update: worldUpdateSpy,
    },
    guild: {
      findFirstOrThrow: jest.fn(async () => guild),
    },
    ship: {
      count: jest.fn(async () => opts.shipCount ?? 3),
    },
  } as unknown as PrismaService;

  return { prisma, world, guild, worldUpdateSpy };
}

describe("DefeatService.checkDefeat", () => {
  it("does nothing when the guild is solvent", async () => {
    const { prisma, world, worldUpdateSpy } = makePrisma({ gold: 5000, shipCount: 3 });
    const service = new DefeatService(prisma, new EventEmitter2());

    await service.checkDefeat("w1", 10);

    expect(world.status).toBe("ACTIVE");
    expect(worldUpdateSpy).not.toHaveBeenCalled();
  });

  it("does nothing when broke but the fleet still has multiple ships", async () => {
    const { prisma, world, worldUpdateSpy } = makePrisma({ gold: 0, shipCount: 2 });
    const service = new DefeatService(prisma, new EventEmitter2());

    await service.checkDefeat("w1", 10);

    expect(world.status).toBe("ACTIVE");
    expect(worldUpdateSpy).not.toHaveBeenCalled();
  });

  it("does nothing when down to the last ship but still solvent", async () => {
    const { prisma, world, worldUpdateSpy } = makePrisma({ gold: 100, shipCount: 1 });
    const service = new DefeatService(prisma, new EventEmitter2());

    await service.checkDefeat("w1", 10);

    expect(world.status).toBe("ACTIVE");
    expect(worldUpdateSpy).not.toHaveBeenCalled();
  });

  it("increments bankruptTicks while broke-and-last-ship persists, below the grace period", async () => {
    const { prisma, world } = makePrisma({ gold: 0, shipCount: 1, bankruptTicks: 5 });
    const service = new DefeatService(prisma, new EventEmitter2());

    await service.checkDefeat("w1", 10);

    expect(world.status).toBe("ACTIVE");
    expect(world.bankruptTicks).toBe(6);
  });

  it("resets bankruptTicks to 0 once the guild recovers", async () => {
    const { prisma, world, worldUpdateSpy } = makePrisma({ gold: 500, shipCount: 2, bankruptTicks: 12 });
    const service = new DefeatService(prisma, new EventEmitter2());

    await service.checkDefeat("w1", 10);

    expect(world.bankruptTicks).toBe(0);
    expect(worldUpdateSpy).toHaveBeenCalledWith({ where: { id: "w1" }, data: { bankruptTicks: 0 } });
  });

  it("declares DEFEAT once the grace period is exhausted", async () => {
    const { prisma, world } = makePrisma({
      gold: 0,
      shipCount: 1,
      bankruptTicks: BALANCE.BANKRUPTCY_GRACE_TICKS - 1,
    });
    const events = new EventEmitter2();
    const emitSpy = jest.spyOn(events, "emit");
    const service = new DefeatService(prisma, events);

    await service.checkDefeat("w1", 42);

    expect(world.status).toBe("DEFEAT");
    expect(emitSpy).toHaveBeenCalledWith(
      WORLD_DEFEAT_EVENT,
      expect.objectContaining({
        worldId: "w1",
        payload: expect.objectContaining({ status: "DEFEAT", reason: "BANKRUPTCY", tick: 42 }),
      }),
    );
  });

  it("skips worlds that are no longer ACTIVE", async () => {
    const { prisma, worldUpdateSpy } = makePrisma({ status: "VICTORY", gold: 0, shipCount: 1 });
    const service = new DefeatService(prisma, new EventEmitter2());

    await service.checkDefeat("w1", 10);

    expect(worldUpdateSpy).not.toHaveBeenCalled();
  });
});
