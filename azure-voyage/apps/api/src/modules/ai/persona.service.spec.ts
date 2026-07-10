import { BALANCE } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AiBudgetService } from "./ai-budget.service";
import type { ClaudeClientService } from "./claude-client.service";
import { PersonaService } from "./persona.service";

function makePrisma(opts: {
  guilds?: { id: string; name: string; aiPersona: unknown }[];
  officers?: { id: string; name: string; skills: string[] }[];
}) {
  const guildUpdates: { where: { id: string }; data: unknown }[] = [];
  const officerUpdates: { where: { id: string }; data: unknown }[] = [];
  const logCalls: { data: unknown }[] = [];

  const prisma = {
    gameWorld: { findUniqueOrThrow: jest.fn(async () => ({ id: "w1", seed: 42 })) },
    guild: {
      findMany: jest.fn(async () => (opts.guilds ?? []).map((g) => ({ kind: "NPC", ...g }))),
      update: jest.fn(async (args: { where: { id: string }; data: unknown }) => {
        guildUpdates.push(args);
        return args;
      }),
    },
    officer: {
      findMany: jest.fn(async () => opts.officers ?? []),
      update: jest.fn(async (args: { where: { id: string }; data: unknown }) => {
        officerUpdates.push(args);
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

  return { prisma, guildUpdates, officerUpdates, logCalls };
}

function makeClaude(callStructured: jest.Mock, enabled = true) {
  return { callStructured, enabled } as unknown as ClaudeClientService;
}

const BASE_GUILD_PERSONA = {
  archetype: "FINANCIER",
  riskTolerance: 0.5,
  aggression: 0.3,
  homeRegionId: "region.amber_gulf",
  placeholder: true,
};

describe("PersonaService.refreshDuePersonas", () => {
  it("skips guilds whose persona is already filled in (no placeholder flag)", async () => {
    const { prisma, guildUpdates } = makePrisma({
      guilds: [{ id: "g1", name: "鎏金天秤商會", aiPersona: { ...BASE_GUILD_PERSONA, placeholder: false } }],
    });
    const claude = makeClaude(jest.fn());
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new PersonaService(prisma, claude, budget);

    await service.refreshDuePersonas("w1");

    expect(guildUpdates).toHaveLength(0);
  });

  it("falls back to a rule-based persona when AI is disabled", async () => {
    const { prisma, guildUpdates, logCalls } = makePrisma({
      guilds: [{ id: "g1", name: "鎏金天秤商會", aiPersona: BASE_GUILD_PERSONA }],
    });
    const claude = makeClaude(jest.fn(), false);
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new PersonaService(prisma, claude, budget);

    await service.refreshDuePersonas("w1");

    expect(guildUpdates).toHaveLength(1);
    const data = guildUpdates[0].data as {
      aiPersona: { placeholder: boolean; description: string; greeting: string; archetype: string };
    };
    expect(data.aiPersona.placeholder).toBe(false);
    expect(data.aiPersona.description.length).toBeGreaterThan(0);
    expect(data.aiPersona.greeting.length).toBeGreaterThan(0);
    expect(data.aiPersona.archetype).toBe("FINANCIER"); // 既有欄位保留
    expect(logCalls[0].data).toMatchObject({ ok: false, kind: "PERSONA" });
  });

  it("falls back without calling the AI when the daily budget is exhausted", async () => {
    const { prisma, guildUpdates } = makePrisma({
      guilds: [{ id: "g1", name: "鎏金天秤商會", aiPersona: BASE_GUILD_PERSONA }],
    });
    const callStructured = jest.fn();
    const claude = makeClaude(callStructured, true);
    const budget = { tryConsume: jest.fn(async () => false) } as unknown as AiBudgetService;
    const service = new PersonaService(prisma, claude, budget);

    await service.refreshDuePersonas("w1");

    expect(callStructured).not.toHaveBeenCalled();
    expect(guildUpdates).toHaveLength(1);
  });

  it("uses a schema-valid AI response as-is and logs success", async () => {
    const gen = { description: "測試描述", greeting: "測試問候" };
    const { prisma, guildUpdates, logCalls } = makePrisma({
      guilds: [{ id: "g1", name: "鎏金天秤商會", aiPersona: BASE_GUILD_PERSONA }],
    });
    const claude = makeClaude(jest.fn(async () => ({ input: gen, inputTokens: 10, outputTokens: 5 })), true);
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new PersonaService(prisma, claude, budget);

    await service.refreshDuePersonas("w1");

    const data = guildUpdates[0].data as { aiPersona: { description: string; greeting: string } };
    expect(data.aiPersona.description).toBe("測試描述");
    expect(data.aiPersona.greeting).toBe("測試問候");
    expect(logCalls[0].data).toMatchObject({ ok: true });
  });

  it("falls back when the AI response fails schema validation", async () => {
    const { prisma, guildUpdates, logCalls } = makePrisma({
      guilds: [{ id: "g1", name: "鎏金天秤商會", aiPersona: BASE_GUILD_PERSONA }],
    });
    const claude = makeClaude(
      jest.fn(async () => ({ input: { description: "" }, inputTokens: 10, outputTokens: 5 })),
      true,
    );
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new PersonaService(prisma, claude, budget);

    await service.refreshDuePersonas("w1");

    const data = guildUpdates[0].data as { aiPersona: { description: string } };
    expect(data.aiPersona.description.length).toBeGreaterThan(0);
    expect(logCalls[0].data).toMatchObject({ ok: false });
  });

  it("respects PERSONA_MAX_PER_TICK across guilds and officers combined", async () => {
    const guilds = Array.from({ length: BALANCE.PERSONA_MAX_PER_TICK + 2 }, (_, i) => ({
      id: `g${i}`,
      name: `商會${i}`,
      aiPersona: BASE_GUILD_PERSONA,
    }));
    const { prisma, guildUpdates, officerUpdates } = makePrisma({
      guilds,
      officers: [{ id: "o1", name: "測試航海士", skills: [] }],
    });
    const claude = makeClaude(jest.fn(), false);
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new PersonaService(prisma, claude, budget);

    await service.refreshDuePersonas("w1");

    expect(guildUpdates).toHaveLength(BALANCE.PERSONA_MAX_PER_TICK);
    expect(officerUpdates).toHaveLength(0); // 額度已被商會用完，這個 tick 輪不到航海士
  });

  it("generates officer personas once guild quota allows room", async () => {
    const { prisma, officerUpdates } = makePrisma({
      guilds: [],
      officers: [{ id: "o1", name: "測試航海士", skills: ["skill.gunnery"] }],
    });
    const claude = makeClaude(jest.fn(), false);
    const budget = { tryConsume: jest.fn(async () => true) } as unknown as AiBudgetService;
    const service = new PersonaService(prisma, claude, budget);

    await service.refreshDuePersonas("w1");

    expect(officerUpdates).toHaveLength(1);
    const data = officerUpdates[0].data as { persona: { description: string; greeting: string } };
    expect(data.persona.description.length).toBeGreaterThan(0);
    expect(data.persona.greeting.length).toBeGreaterThan(0);
  });
});
