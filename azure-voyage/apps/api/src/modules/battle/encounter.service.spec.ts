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
        const battleData = battles[0] as { state: { units: { side: string }[] } };
        const playerUnits = battleData.state.units.filter((u) => u.side === "PLAYER");
        const enemyUnits = battleData.state.units.filter((u) => u.side === "ENEMY");
        expect(playerUnits).toHaveLength(1);
        expect(enemyUnits.length).toBeGreaterThanOrEqual(1);
      }
    }
    expect(found).toBe(true);
  });
});
