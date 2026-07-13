import type { PrismaService } from "../../prisma/prisma.service";
import type { ClaudeClientService } from "./claude-client.service";
import { DialogueService } from "./dialogue.service";
import type { EventGenService } from "./event-gen.service";

/** 極簡 in-memory redis mock：只實作這個服務用得到的指令。 */
function makeRedis() {
  const store = new Map<string, string>();
  const lists = new Map<string, string[]>();
  return {
    set: jest.fn(async (key: string, value: string, ..._rest: unknown[]) => {
      if (store.has(key)) return null; // 模擬 NX：已存在就失敗
      store.set(key, value);
      return "OK";
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    incr: jest.fn(async (key: string) => {
      const v = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(v));
      return v;
    }),
    expire: jest.fn(async () => 1),
    lrange: jest.fn(async (key: string) => lists.get(key) ?? []),
    rpush: jest.fn(async (key: string, value: string) => {
      const arr = lists.get(key) ?? [];
      arr.push(value);
      lists.set(key, arr);
      return arr.length;
    }),
    ltrim: jest.fn(async () => "OK"),
    _store: store,
    _lists: lists,
  };
}

function makePrisma(opts: {
  guild?: { id: string; name: string; aiPersona: unknown } | null;
  officer?: { id: string; name: string; persona: unknown } | null;
  portNotable?: { id: string; name: string; persona: unknown } | null;
  worldUserId?: string;
}) {
  const logCalls: { data: unknown }[] = [];
  const prisma = {
    gameWorld: {
      findUnique: jest.fn(async () => ({ id: "w1", userId: opts.worldUserId ?? "u1", seed: 42 })),
    },
    guild: {
      findFirst: jest.fn(async () => opts.guild ?? null),
    },
    officer: {
      findFirst: jest.fn(async () => opts.officer ?? null),
    },
    portNotable: {
      findFirst: jest.fn(async () => opts.portNotable ?? null),
    },
    aiGenerationLog: {
      create: jest.fn(async (args: { data: unknown }) => {
        logCalls.push(args);
        return args;
      }),
    },
  } as unknown as PrismaService;
  return { prisma, logCalls };
}

function makeClaude(chat: jest.Mock, enabled = true) {
  return { chat, enabled } as unknown as ClaudeClientService;
}

function makeEventGen(triggerRumorNow = jest.fn(async () => undefined)) {
  return { triggerRumorNow } as unknown as EventGenService;
}

const NPC_GUILD = { id: "g1", name: "鎏金天秤商會", aiPersona: { description: "精明的商人", greeting: "「歡迎光臨。」" } };

describe("DialogueService.chat", () => {
  it("throws NOT_FOUND when the world doesn't belong to the user", async () => {
    const { prisma } = makePrisma({ guild: NPC_GUILD, worldUserId: "someone-else" });
    const redis = makeRedis();
    const service = new DialogueService(prisma, makeClaude(jest.fn()), makeEventGen(), redis as never);

    await expect(service.chat("u1", "w1", "GUILD", "g1", "hi")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when the guild target doesn't exist", async () => {
    const { prisma } = makePrisma({ guild: null });
    const redis = makeRedis();
    const service = new DialogueService(prisma, makeClaude(jest.fn()), makeEventGen(), redis as never);

    await expect(service.chat("u1", "w1", "GUILD", "missing", "hi")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws DIALOGUE_COOLDOWN on a second call within the cooldown window", async () => {
    const { prisma } = makePrisma({ guild: NPC_GUILD });
    const redis = makeRedis();
    const claude = makeClaude(jest.fn(async () => ({ text: "回覆", toolCalls: [], inputTokens: 1, outputTokens: 1 })));
    const service = new DialogueService(prisma, claude, makeEventGen(), redis as never);

    await service.chat("u1", "w1", "GUILD", "g1", "hi");
    await expect(service.chat("u1", "w1", "GUILD", "g1", "hi again")).rejects.toMatchObject({
      code: "DIALOGUE_COOLDOWN",
    });
  });

  it("falls back to the persona greeting when AI is disabled", async () => {
    const { prisma } = makePrisma({ guild: NPC_GUILD });
    const redis = makeRedis();
    const claude = makeClaude(jest.fn(), false);
    const service = new DialogueService(prisma, claude, makeEventGen(), redis as never);

    const res = await service.chat("u1", "w1", "GUILD", "g1", "hi");
    expect(res.reply).toBe(NPC_GUILD.aiPersona.greeting);
    expect(res.rumorTriggered).toBe(false);
  });

  it("falls back when the AI call fails and logs the failure", async () => {
    const { prisma, logCalls } = makePrisma({ guild: NPC_GUILD });
    const redis = makeRedis();
    const claude = makeClaude(jest.fn(async () => null), true);
    const service = new DialogueService(prisma, claude, makeEventGen(), redis as never);

    const res = await service.chat("u1", "w1", "GUILD", "g1", "hi");
    expect(res.reply).toBe(NPC_GUILD.aiPersona.greeting);
    expect(logCalls[0].data).toMatchObject({ ok: false, kind: "DIALOGUE" });
  });

  it("uses the AI reply as-is and logs success", async () => {
    const { prisma, logCalls } = makePrisma({ guild: NPC_GUILD });
    const redis = makeRedis();
    const claude = makeClaude(
      jest.fn(async () => ({ text: "「生意興隆，你要買點什麼嗎？」", toolCalls: [], inputTokens: 10, outputTokens: 5 })),
    );
    const service = new DialogueService(prisma, claude, makeEventGen(), redis as never);

    const res = await service.chat("u1", "w1", "GUILD", "g1", "有什麼好貨？");
    expect(res.reply).toBe("「生意興隆，你要買點什麼嗎？」");
    expect(res.rumorTriggered).toBe(false);
    expect(logCalls[0].data).toMatchObject({ ok: true });
  });

  it("triggers a rumor event when the model calls offer_rumor", async () => {
    const { prisma } = makePrisma({ guild: NPC_GUILD });
    const redis = makeRedis();
    const triggerRumorNow = jest.fn(async () => undefined);
    const claude = makeClaude(
      jest.fn(async () => ({
        text: "「聽說最近港口有些消息……」",
        toolCalls: [{ name: "offer_rumor", input: {} }],
        inputTokens: 10,
        outputTokens: 5,
      })),
    );
    const service = new DialogueService(prisma, claude, makeEventGen(triggerRumorNow), redis as never);

    const res = await service.chat("u1", "w1", "GUILD", "g1", "有什麼傳聞嗎？");
    expect(res.rumorTriggered).toBe(true);
    expect(triggerRumorNow).toHaveBeenCalledWith("w1");
  });

  it("persists both turns of the conversation to redis history", async () => {
    const { prisma } = makePrisma({ guild: NPC_GUILD });
    const redis = makeRedis();
    const claude = makeClaude(jest.fn(async () => ({ text: "回覆", toolCalls: [], inputTokens: 1, outputTokens: 1 })));
    const service = new DialogueService(prisma, claude, makeEventGen(), redis as never);

    await service.chat("u1", "w1", "GUILD", "g1", "你好");
    const history = redis._lists.get("dialogue:history:w1:GUILD:g1") ?? [];
    expect(history).toHaveLength(2);
    expect(JSON.parse(history[0])).toMatchObject({ role: "user", content: "你好" });
    expect(JSON.parse(history[1])).toMatchObject({ role: "assistant", content: "回覆" });
  });

  it("falls back without calling the AI once the daily dialogue limit is hit", async () => {
    const { prisma } = makePrisma({ guild: NPC_GUILD });
    const redis = makeRedis();
    const day = new Date().toISOString().slice(0, 10);
    redis._store.set(`dialogue:count:w1:${day}`, "60");
    const chat = jest.fn(async () => ({ text: "不應該被呼叫", toolCalls: [], inputTokens: 1, outputTokens: 1 }));
    const claude = makeClaude(chat, true);
    const service = new DialogueService(prisma, claude, makeEventGen(), redis as never);

    const res = await service.chat("u1", "w1", "GUILD", "g1", "hi");
    expect(chat).not.toHaveBeenCalled();
    expect(res.reply).toBe(NPC_GUILD.aiPersona.greeting);
  });

  it("resolves an OFFICER target from the officer table", async () => {
    const { prisma } = makePrisma({
      officer: { id: "o1", name: "賽菈・凡德", persona: { description: "冷靜的航海長", greeting: "「有何指示？」" } },
    });
    const redis = makeRedis();
    const claude = makeClaude(jest.fn(), false);
    const service = new DialogueService(prisma, claude, makeEventGen(), redis as never);

    const res = await service.chat("u1", "w1", "OFFICER", "o1", "hi");
    expect(res.reply).toBe("「有何指示？」");
  });

  it("resolves a PORT_NOTABLE target from the port notable table (M25)", async () => {
    const { prisma } = makePrisma({
      portNotable: { id: "n1", name: "馬瑟斯・凡登霍夫", persona: { description: "港務總管", greeting: "「歡迎來到本港。」" } },
    });
    const redis = makeRedis();
    const claude = makeClaude(jest.fn(), false);
    const service = new DialogueService(prisma, claude, makeEventGen(), redis as never);

    const res = await service.chat("u1", "w1", "PORT_NOTABLE", "n1", "hi");
    expect(res.reply).toBe("「歡迎來到本港。」");
  });
});
