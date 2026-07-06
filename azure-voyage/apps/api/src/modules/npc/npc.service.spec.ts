import { BALANCE, PORTS } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import type { InfluenceService } from "../influence/influence.service";
import { NpcService } from "./npc.service";

const HOME_REGION = PORTS[0].regionId;

function makePrisma(guilds: { id: string; gold: number; aiPersona: unknown }[]) {
  const prisma = {
    gameWorld: { findUniqueOrThrow: jest.fn(async () => ({ id: "w1", seed: 12345 })) },
    guild: {
      findMany: jest.fn(async () =>
        guilds.map((g) => ({ id: g.id, kind: "NPC", gold: BigInt(g.gold), aiPersona: g.aiPersona })),
      ),
    },
  } as unknown as PrismaService;
  return prisma;
}

describe("NpcService.actAll", () => {
  it("does nothing off the NPC action interval", async () => {
    const prisma = makePrisma([{ id: "g1", gold: 1000, aiPersona: { riskTolerance: 0.5, homeRegionId: HOME_REGION } }]);
    const investAsGuild = jest.fn();
    const service = new NpcService(prisma, { investAsGuild } as unknown as InfluenceService);

    await service.actAll("w1", BALANCE.NPC_ACT_INTERVAL_TICKS - 1);

    expect(investAsGuild).not.toHaveBeenCalled();
  });

  it("skips NPC guilds without a persona", async () => {
    const prisma = makePrisma([{ id: "g1", gold: 1000, aiPersona: null }]);
    const investAsGuild = jest.fn();
    const service = new NpcService(prisma, { investAsGuild } as unknown as InfluenceService);

    await service.actAll("w1", BALANCE.NPC_ACT_INTERVAL_TICKS);

    expect(investAsGuild).not.toHaveBeenCalled();
  });

  it("delegates to InfluenceService.investAsGuild for a risk-scaled amount on a home-region port", async () => {
    const prisma = makePrisma([
      { id: "g1", gold: 1000, aiPersona: { archetype: "trader", riskTolerance: 0.5, aggression: 0.2, homeRegionId: HOME_REGION } },
    ]);
    const investAsGuild = jest.fn(async () => ({ gain: 1 }));
    const service = new NpcService(prisma, { investAsGuild } as unknown as InfluenceService);

    await service.actAll("w1", BALANCE.NPC_ACT_INTERVAL_TICKS);

    expect(investAsGuild).toHaveBeenCalledTimes(1);
    const [worldId, guildId, portId, amount] = (investAsGuild as jest.Mock).mock.calls[0] as [
      string,
      string,
      string,
      number,
    ];
    expect(worldId).toBe("w1");
    expect(guildId).toBe("g1");
    expect(PORTS.some((p) => p.id === portId && p.regionId === HOME_REGION)).toBe(true);
    expect(amount).toBe(Math.round(1000 * BALANCE.NPC_INVEST_GOLD_FRACTION * 0.5));
  });

  it("skips a guild when the risk-scaled amount would be zero", async () => {
    const prisma = makePrisma([
      { id: "g1", gold: 1, aiPersona: { riskTolerance: 0.01, homeRegionId: HOME_REGION } },
    ]);
    const investAsGuild = jest.fn();
    const service = new NpcService(prisma, { investAsGuild } as unknown as InfluenceService);

    await service.actAll("w1", BALANCE.NPC_ACT_INTERVAL_TICKS);

    expect(investAsGuild).not.toHaveBeenCalled();
  });
});
