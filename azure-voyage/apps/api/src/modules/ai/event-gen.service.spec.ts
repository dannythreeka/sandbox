import { EventEmitter2 } from "@nestjs/event-emitter";
import { BALANCE } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AiBudgetService } from "./ai-budget.service";
import type { ClaudeClientService } from "./claude-client.service";
import { EventGenService } from "./event-gen.service";

function makePrisma(gold = 1000, fame = 0) {
  const playerGuild = { id: "g-player", gold: BigInt(gold), fame };
  const worldEvents: { data: unknown }[] = [];
  const logCalls: { data: unknown }[] = [];
  const guildUpdates: { data: { gold: bigint; fame: number } }[] = [];

  const prisma = {
    gameWorld: { findUniqueOrThrow: jest.fn(async () => ({ id: "w1", seed: 7 })) },
    guild: {
      findFirstOrThrow: jest.fn(async () => playerGuild),
      update: jest.fn(async (args: { data: { gold: bigint; fame: number } }) => {
        guildUpdates.push(args);
        Object.assign(playerGuild, args.data);
        return playerGuild;
      }),
    },
    worldEvent: {
      create: jest.fn(async (args: { data: unknown }) => {
        worldEvents.push(args);
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

  return { prisma, worldEvents, logCalls, guildUpdates, playerGuild };
}

function makeClaude(callStructured: jest.Mock, enabled = true) {
  return { callStructured, enabled } as unknown as ClaudeClientService;
}

describe("EventGenService.maybeGenerateRumor", () => {
  it("does nothing off the AI event interval", async () => {
    const { prisma, worldEvents } = makePrisma();
    const claude = makeClaude(jest.fn());
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new EventGenService(prisma, claude, budget, new EventEmitter2());

    await service.maybeGenerateRumor("w1", BALANCE.AI_EVENT_INTERVAL_TICKS - 1);
    expect(worldEvents).toHaveLength(0);
  });

  it("creates a RULE-sourced rumor and credits the player when AI is disabled", async () => {
    const { prisma, worldEvents, guildUpdates } = makePrisma(1000, 0);
    const claude = makeClaude(jest.fn(), false);
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new EventGenService(prisma, claude, budget, new EventEmitter2());

    await service.maybeGenerateRumor("w1", BALANCE.AI_EVENT_INTERVAL_TICKS);

    expect(worldEvents).toHaveLength(1);
    const created = worldEvents[0].data as { source: string; type: string; narrative: string };
    expect(created.source).toBe("RULE");
    expect(created.type).toBe("RUMOR");
    expect(created.narrative.length).toBeGreaterThan(0);
    expect(guildUpdates).toHaveLength(1);
    expect(guildUpdates[0].data.gold).toBeGreaterThan(1000n);
  });

  it("broadcasts a server:event-shaped domain event", async () => {
    const { prisma } = makePrisma();
    const claude = makeClaude(jest.fn(), false);
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const events = new EventEmitter2();
    const received: unknown[] = [];
    events.on("world.event", (payload) => received.push(payload));
    const service = new EventGenService(prisma, claude, budget, events);

    await service.maybeGenerateRumor("w1", BALANCE.AI_EVENT_INTERVAL_TICKS);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ worldId: "w1", payload: { event: { type: "RUMOR" } } });
  });

  it("falls back to RULE when the AI response fails schema validation", async () => {
    const { prisma, worldEvents, logCalls } = makePrisma();
    const claude = makeClaude(
      jest.fn(async () => ({ input: { type: "RUMOR", title: "x" }, inputTokens: 10, outputTokens: 5 })),
      true,
    );
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new EventGenService(prisma, claude, budget, new EventEmitter2());

    await service.maybeGenerateRumor("w1", BALANCE.AI_EVENT_INTERVAL_TICKS);

    // source is still "AI" per claude.enabled flag, but narrative content is fallback-generated
    const created = worldEvents[0].data as { narrative: string };
    expect(created.narrative.length).toBeGreaterThan(0);
    expect(logCalls[0].data).toMatchObject({ ok: false });
  });

  it("uses a schema-valid AI response as-is and logs success", async () => {
    const proposal = { type: "RUMOR", title: "T", narrative: "N", goldReward: 100, fameReward: 2 };
    const { prisma, worldEvents, logCalls, guildUpdates } = makePrisma(1000, 0);
    const claude = makeClaude(jest.fn(async () => ({ input: proposal, inputTokens: 10, outputTokens: 5 })), true);
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new EventGenService(prisma, claude, budget, new EventEmitter2());

    await service.maybeGenerateRumor("w1", BALANCE.AI_EVENT_INTERVAL_TICKS);

    const created = worldEvents[0].data as { source: string; narrative: string };
    expect(created.source).toBe("AI");
    expect(created.narrative).toBe("N");
    expect(logCalls[0].data).toMatchObject({ ok: true });
    expect(guildUpdates[0].data.gold).toBe(1100n);
    expect(guildUpdates[0].data.fame).toBe(2);
  });
});
