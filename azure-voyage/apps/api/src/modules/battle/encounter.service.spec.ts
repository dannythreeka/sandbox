import { oddrToAxial, portById } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { EncounterService } from "./encounter.service";

function makePrisma(fleetPos: { q: number; r: number }, seed: number) {
  const world = { id: "w1", seed };
  const fleet = {
    id: "f1",
    worldId: "w1",
    activity: "SAILING",
    posQ: fleetPos.q,
    posR: fleetPos.r,
    ships: [{ id: "s1", shipClassId: "ship.lugger", name: "旗艦", hull: 55, crew: 8 }],
    officers: [] as { id: string; role: string | null; stats: unknown }[],
    guild: { captainLead: 20, captainNav: 20, captainCombat: 20, captainTrade: 20, captainLore: 20 },
  };
  const battles: unknown[] = [];
  const fleetUpdates: { activity: string }[] = [];

  const prisma = {
    gameWorld: { findUniqueOrThrow: jest.fn(async () => world) },
    fleet: {
      findMany: jest.fn(async () => [fleet]),
      update: jest.fn(async ({ data }: { data: { activity: string } }) => {
        fleetUpdates.push(data);
      }),
    },
    battle: {
      create: jest.fn(async ({ data }: { data: unknown }) => {
        battles.push(data);
        return { id: `b${battles.length}`, ...(data as object) };
      }),
    },
  } as unknown as PrismaService;

  return { prisma, battles, fleetUpdates };
}

describe("EncounterService.rollEncounters", () => {
  it("never triggers an encounter in a zero-danger region (safety-net seed sweep)", async () => {
    // 用 amber_gulf（危險度低）多個 seed 掃描，確保沒有離譜的誤觸發率
    const homeAxial = oddrToAxial(portById("port.amber_gulf.aurelia").coord);
    let triggered = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { prisma, battles } = makePrisma(homeAxial, seed);
      const service = new EncounterService(prisma, { emit: jest.fn() } as never);
      await service.rollEncounters("w1", seed);
      if (battles.length > 0) triggered++;
    }
    // 琥珀灣危險度 0.1 × ENCOUNTER_CHANCE_PER_DANGER(0.15) = 1.5%；200 次抽樣不應該離譜偏高
    expect(triggered).toBeLessThan(30);
  });

  it("creates a battle and flips the fleet to IN_BATTLE when an encounter fires", async () => {
    // 子午之海危險度高很多，用大量 seed 掃描找到至少一次觸發來驗證資料形狀
    const dangerousAxial = oddrToAxial(portById("port.meridian.zafrahn").coord);
    let found = false;
    for (let seed = 0; seed < 500 && !found; seed++) {
      const { prisma, battles, fleetUpdates } = makePrisma(dangerousAxial, seed);
      const service = new EncounterService(prisma, { emit: jest.fn() } as never);
      await service.rollEncounters("w1", seed);
      if (battles.length > 0) {
        found = true;
        expect(fleetUpdates).toContainEqual({ activity: "IN_BATTLE" });
        const battleData = battles[0] as { fleetId: string; state: { units: { side: string }[] } };
        const playerUnits = battleData.state.units.filter((u) => u.side === "PLAYER");
        const enemyUnits = battleData.state.units.filter((u) => u.side === "ENEMY");
        expect(playerUnits).toHaveLength(1);
        expect(enemyUnits.length).toBeGreaterThanOrEqual(1);
        // bug 修復：battle 要記下 fleetId，重新連線時才查得到「我的艦隊在哪場海戰裡」
        expect(battleData.fleetId).toBe("f1");
      }
    }
    expect(found).toBe(true);
  });

  it("applies the gunner damage bonus (M23) to the player unit when a battle starts", async () => {
    const dangerousAxial = oddrToAxial(portById("port.meridian.zafrahn").coord);
    let found = false;
    for (let seed = 0; seed < 500 && !found; seed++) {
      const { prisma, battles } = makePrisma(dangerousAxial, seed);
      // 手動塞一位炮術長進艦隊（M23 GUNNER 職位加成）
      (prisma.fleet.findMany as jest.Mock).mockImplementationOnce(async () => [
        {
          id: "f1",
          worldId: "w1",
          activity: "SAILING",
          posQ: dangerousAxial.q,
          posR: dangerousAxial.r,
          ships: [{ id: "s1", shipClassId: "ship.lugger", name: "旗艦", hull: 55, crew: 8 }],
          officers: [{ id: "o1", role: "GUNNER", stats: { combat: 80 } }],
          guild: { captainLead: 20, captainNav: 20, captainCombat: 20, captainTrade: 20, captainLore: 20 },
        },
      ]);
      const service = new EncounterService(prisma, { emit: jest.fn() } as never);
      await service.rollEncounters("w1", seed);
      if (battles.length > 0) {
        found = true;
        const battleData = battles[0] as { state: { units: { side: string; damageBonusPct: number }[] } };
        const playerUnit = battleData.state.units.find((u) => u.side === "PLAYER")!;
        expect(playerUnit.damageBonusPct).toBeGreaterThan(0);
      }
    }
    expect(found).toBe(true);
  });

  it("reduces the encounter trigger rate when the fleet has a lookout (M23)", async () => {
    const dangerousAxial = oddrToAxial(portById("port.meridian.zafrahn").coord);
    let withoutLookout = 0;
    let withLookout = 0;
    const trials = 300;
    for (let seed = 0; seed < trials; seed++) {
      const { prisma: p1, battles: b1 } = makePrisma(dangerousAxial, seed);
      await new EncounterService(p1, { emit: jest.fn() } as never).rollEncounters("w1", seed);
      if (b1.length > 0) withoutLookout++;

      const { prisma: p2, battles: b2 } = makePrisma(dangerousAxial, seed);
      (p2.fleet.findMany as jest.Mock).mockImplementationOnce(async () => [
        {
          id: "f1",
          worldId: "w1",
          activity: "SAILING",
          posQ: dangerousAxial.q,
          posR: dangerousAxial.r,
          ships: [{ id: "s1", shipClassId: "ship.lugger", name: "旗艦", hull: 55, crew: 8 }],
          officers: [{ id: "o1", role: "LOOKOUT", stats: { lore: 100 } }],
          guild: { captainLead: 20, captainNav: 20, captainCombat: 20, captainTrade: 20, captainLore: 20 },
        },
      ]);
      await new EncounterService(p2, { emit: jest.fn() } as never).rollEncounters("w1", seed);
      if (b2.length > 0) withLookout++;
    }
    expect(withLookout).toBeLessThan(withoutLookout);
  });
});
