import { HOME_PORT_ID, initBattleState, shipClassById, unitFromShip, type BattleState } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { BATTLE_END_EVENT, BattleService } from "./battle.service";

const SEED = 12345;

/** 血量健康的敵艦：不會觸發低血量逃跑判定，適合測試「純自動解算流程」。 */
function makeUnits() {
  const lugger = shipClassById("ship.lugger");
  const player = unitFromShip("s1", "PLAYER", "旗艦", lugger, { q: -2, r: 0 }, lugger.maxHull, 8);
  const enemy = unitFromShip("enemy-0", "ENEMY", "海賊船", lugger, { q: 2, r: 0 }, 50, 4);
  return [player, enemy];
}

/** 血量僅剩 1：保證玩家第一發砲擊必定擊沉，敵方永遠沒有機會行動或逃跑。 */
function makeOneShotUnits() {
  const lugger = shipClassById("ship.lugger");
  const player = unitFromShip("s1", "PLAYER", "旗艦", lugger, { q: -2, r: 0 }, lugger.maxHull, 8);
  const enemy = unitFromShip("enemy-0", "ENEMY", "海賊船", lugger, { q: 2, r: 0 }, 1, 4);
  return [player, enemy];
}

/**
 * 玩家血量僅剩 1、敵方血量健康：玩家 REPAIR（不攻擊）後，敵方 AI 必定選擇 FIRE
 * （血量健康不會觸發逃跑判定），FIRE 傷害保底至少 1 點，保證一擊擊沉玩家——
 * 不必掃描 seed 就能穩定重現 PLAYER_LOSE，用來驗證戰敗贖金與拖回母港的結算。
 */
function makePlayerAboutToLoseUnits() {
  const lugger = shipClassById("ship.lugger");
  const player = unitFromShip("s1", "PLAYER", "旗艦", lugger, { q: -2, r: 0 }, 1, 8);
  const enemy = unitFromShip("enemy-0", "ENEMY", "海賊船", lugger, { q: 2, r: 0 }, 50, 4);
  return [player, enemy];
}

function makePrisma(state: BattleState, opts: { gold?: number; status?: string } = {}) {
  const world = { id: "w1", userId: "u1" };
  const guild = { id: "g1", gold: BigInt(opts.gold ?? 10000) };
  const fleet = { id: "f1", worldId: "w1", guildId: "g1" };
  const battle = {
    id: "b1",
    worldId: "w1",
    seed: SEED,
    round: state.round,
    startedTick: 5,
    status: opts.status ?? "ONGOING",
    state,
    actionLog: [] as string[],
  };
  const ships = [{ id: "s1", fleetId: "f1", hull: 55 }];

  const prisma = {
    gameWorld: { findUnique: jest.fn(async () => world) },
    battle: {
      findUnique: jest.fn(async () => battle),
      update: jest.fn(async ({ data }: { data: Partial<typeof battle> }) => {
        Object.assign(battle, data);
      }),
    },
    ship: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        ships.filter((s) => where.id.in.includes(s.id)),
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<{ hull: number }> }) => {
        Object.assign(ships.find((s) => s.id === where.id)!, data);
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const idx = ships.findIndex((s) => s.id === where.id);
        if (idx >= 0) ships.splice(idx, 1);
      }),
    },
    fleet: {
      findUniqueOrThrow: jest.fn(async () => fleet),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(fleet, data);
      }),
    },
    guild: {
      findUniqueOrThrow: jest.fn(async () => guild),
      update: jest.fn(async ({ data }: { data: { gold: bigint } }) => {
        guild.gold = data.gold;
      }),
    },
    officer: {
      findMany: jest.fn(async () => [] as { id: string; role: string | null; stats: unknown; exp: number }[]),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  return { prisma, battle, guild, fleet, ships };
}

describe("BattleService.applyAction", () => {
  it("rejects acting on an enemy unit id", async () => {
    const state = initBattleState(makeUnits());
    const { prisma } = makePrisma(state);
    const service = new BattleService(prisma, { emit: jest.fn() } as never);

    await expect(
      service.applyAction("u1", "w1", "b1", { type: "FIRE", unitId: "enemy-0", targetId: "s1" }),
    ).rejects.toMatchObject({ code: "BATTLE_ACTION_INVALID" });
  });

  it("rejects acting on a battle that already ended", async () => {
    const state = initBattleState(makeUnits());
    const { prisma } = makePrisma(state, { status: "PLAYER_WIN" });
    const service = new BattleService(prisma, { emit: jest.fn() } as never);

    await expect(
      service.applyAction("u1", "w1", "b1", { type: "REPAIR", unitId: "s1" }),
    ).rejects.toMatchObject({ code: "BATTLE_NOT_ACTIVE" });
  });

  it("auto-resolves the enemy's turn after a valid player action", async () => {
    const state = initBattleState(makeUnits());
    const { prisma, battle } = makePrisma(state);
    const service = new BattleService(prisma, { emit: jest.fn() } as never);

    const result = await service.applyAction("u1", "w1", "b1", { type: "REPAIR", unitId: "s1" });

    // 玩家修理後，敵方應已自動行動一次（round 前進或至少 pendingUnitIds 只剩玩家）
    expect(battle.actionLog.length).toBeGreaterThanOrEqual(2);
    expect(result.status).toBe("ONGOING");
  });

  it("ends the battle, pays loot, and resumes sailing on PLAYER_WIN", async () => {
    // 敵艦血量僅剩 1：第一發砲擊必定擊沉，敵方永遠沒有機會逃跑或行動
    const state = initBattleState(makeOneShotUnits());
    const { prisma, guild, fleet, ships } = makePrisma(state, { gold: 1000 });
    const service = new BattleService(prisma, { emit: jest.fn() } as never);

    const result = await service.applyAction("u1", "w1", "b1", {
      type: "FIRE",
      unitId: "s1",
      targetId: "enemy-0",
    });

    expect(result.status).toBe("PLAYER_WIN");
    expect(Number(guild.gold)).toBeGreaterThan(1000);
    expect(fleet).toMatchObject({ activity: "SAILING" });
    expect(ships.find((s) => s.id === "s1")).toBeDefined(); // 玩家船隻保留
  });

  // bug 修復：戰敗被拖回母港＋扣贖金，前端要靠 ransom 顯示明確的過場畫面
  it("charges ransom and drags the fleet home on PLAYER_LOSE", async () => {
    const state = initBattleState(makePlayerAboutToLoseUnits());
    const { prisma, guild, fleet } = makePrisma(state, { gold: 1000 });
    const emit = jest.fn();
    const service = new BattleService(prisma, { emit } as never);

    // 玩家 MOVE（不回血、不攻擊敵方），讓敵方接著 FIRE 一擊擊沉血量僅剩 1 的玩家船
    const result = await service.applyAction("u1", "w1", "b1", {
      type: "MOVE",
      unitId: "s1",
      to: { q: -1, r: 0 },
    });

    expect(result.status).toBe("PLAYER_LOSE");
    expect(Number(guild.gold)).toBeLessThan(1000);
    expect(fleet).toMatchObject({ activity: "DOCKED", dockedPortId: HOME_PORT_ID });

    const endCall = emit.mock.calls.find(([event]) => event === BATTLE_END_EVENT);
    expect(endCall).toBeDefined();
    const payload = endCall![1] as { payload: { status: string; ransom?: number } };
    expect(payload.payload.status).toBe("PLAYER_LOSE");
    expect(payload.payload.ransom).toBeGreaterThan(0);
    expect(payload.payload.ransom).toBe(1000 - Number(guild.gold));
  });

  it("awards exp to the fleet's officers on PLAYER_WIN (M23)", async () => {
    const state = initBattleState(makeOneShotUnits());
    const { prisma } = makePrisma(state, { gold: 1000 });
    (prisma.officer.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "o1", exp: 0, stats: { lead: 10, nav: 10, combat: 10, trade: 10, lore: 10 } },
    ]);
    const service = new BattleService(prisma, { emit: jest.fn() } as never);

    await service.applyAction("u1", "w1", "b1", { type: "FIRE", unitId: "s1", targetId: "enemy-0" });

    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "o1" } }),
    );
  });
});
