import { BALANCE, PORTS } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AiBudgetService } from "./ai-budget.service";
import type { ClaudeClientService } from "./claude-client.service";
import { NpcStrategyService } from "./npc-strategy.service";

const HOME_REGION = PORTS[0].regionId;

function makePrisma(guilds: { id: string; aiPersona: unknown; aiStrategyUpdatedTick: number | null }[]) {
  const updateCalls: { where: { id: string }; data: unknown }[] = [];
  const logCalls: { data: unknown }[] = [];
  const prisma = {
    gameWorld: { findUniqueOrThrow: jest.fn(async () => ({ id: "w1", seed: 42 })) },
    guild: {
      findMany: jest.fn(async () => guilds.map((g) => ({ kind: "NPC", ...g }))),
      update: jest.fn(async (args: { where: { id: string }; data: unknown }) => {
        updateCalls.push(args);
        return args;
      }),
    },
    aiGenerationLog: {
      create: jest.fn(async (args: { data: unknown }) => {
        logCalls.push(args);
        return args;
      }),
    },
  } as unknown as PrismaService;
  return { prisma, updateCalls, logCalls };
}

function makeClaude(callStructured: jest.Mock) {
  return { callStructured, enabled: true } as unknown as ClaudeClientService;
}

describe("NpcStrategyService.refreshDueStrategies", () => {
  it("skips a guild whose strategy is still within its validity window", async () => {
    const { prisma, updateCalls } = makePrisma([
      { id: "g1", aiPersona: { archetype: "trader", riskTolerance: 0.5, homeRegionId: HOME_REGION }, aiStrategyUpdatedTick: 10 },
    ]);
    const claude = makeClaude(jest.fn());
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new NpcStrategyService(prisma, claude, budget);

    await service.refreshDueStrategies("w1", 10 + BALANCE.NPC_STRATEGY_INTERVAL_TICKS - 1);

    expect(updateCalls).toHaveLength(0);
  });

  it("skips a guild without a persona", async () => {
    const { prisma, updateCalls } = makePrisma([{ id: "g1", aiPersona: null, aiStrategyUpdatedTick: null }]);
    const claude = makeClaude(jest.fn());
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new NpcStrategyService(prisma, claude, budget);

    await service.refreshDueStrategies("w1", 100);
    expect(updateCalls).toHaveLength(0);
  });

  it("falls back to a rule-based strategy when the AI call fails", async () => {
    const { prisma, updateCalls, logCalls } = makePrisma([
      { id: "g1", aiPersona: { archetype: "trader", riskTolerance: 0.5, homeRegionId: HOME_REGION }, aiStrategyUpdatedTick: null },
    ]);
    const claude = makeClaude(jest.fn(async () => null));
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new NpcStrategyService(prisma, claude, budget);

    await service.refreshDueStrategies("w1", 100);

    expect(updateCalls).toHaveLength(1);
    const data = updateCalls[0].data as { aiStrategy: { goals: { regionId: string }[] }; aiStrategyUpdatedTick: number };
    expect(data.aiStrategy.goals[0].regionId).toBe(HOME_REGION);
    expect(data.aiStrategyUpdatedTick).toBe(100);
    expect(logCalls[0].data).toMatchObject({ ok: false });
  });

  it("falls back without calling the AI when the daily budget is exhausted", async () => {
    const { prisma, updateCalls } = makePrisma([
      { id: "g1", aiPersona: { archetype: "trader", riskTolerance: 0.5, homeRegionId: HOME_REGION }, aiStrategyUpdatedTick: null },
    ]);
    const callStructured = jest.fn();
    const claude = makeClaude(callStructured);
    const budget = { tryConsume: jest.fn(async () => false) } as unknown as AiBudgetService;
    const service = new NpcStrategyService(prisma, claude, budget);

    await service.refreshDueStrategies("w1", 100);

    expect(callStructured).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(1);
  });

  it("falls back when the AI response fails schema validation", async () => {
    const { prisma, updateCalls, logCalls } = makePrisma([
      { id: "g1", aiPersona: { archetype: "trader", riskTolerance: 0.5, homeRegionId: HOME_REGION }, aiStrategyUpdatedTick: null },
    ]);
    const claude = makeClaude(jest.fn(async () => ({ input: { goals: "not-an-array" }, inputTokens: 10, outputTokens: 5 })));
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new NpcStrategyService(prisma, claude, budget);

    await service.refreshDueStrategies("w1", 100);

    const data = updateCalls[0].data as { aiStrategy: { goals: { regionId: string }[] } };
    expect(data.aiStrategy.goals[0].regionId).toBe(HOME_REGION);
    expect(logCalls[0].data).toMatchObject({ ok: false });
  });

  it("accepts a schema-valid AI response as-is", async () => {
    const aiStrategy = {
      goals: [{ kind: "INVEST_PORT", regionId: HOME_REGION, portIds: [], priority: 5 }],
      validUntilTick: 200,
    };
    const { prisma, updateCalls, logCalls } = makePrisma([
      { id: "g1", aiPersona: { archetype: "trader", riskTolerance: 0.5, homeRegionId: HOME_REGION }, aiStrategyUpdatedTick: null },
    ]);
    const claude = makeClaude(jest.fn(async () => ({ input: aiStrategy, inputTokens: 10, outputTokens: 5 })));
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new NpcStrategyService(prisma, claude, budget);

    await service.refreshDueStrategies("w1", 100);

    const data = updateCalls[0].data as { aiStrategy: unknown };
    expect(data.aiStrategy).toEqual(aiStrategy);
    expect(logCalls[0].data).toMatchObject({ ok: true });
  });
});
