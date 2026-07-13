import { BALANCE } from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { OfficerService } from "./officer.service";

const PORT_ID = "port.amber_gulf.aurelia";

interface OfficerRow {
  id: string;
  worldId: string;
  fleetId: string | null;
  locationPortId: string | null;
  role: string | null;
  loyalty: number;
  salary: number;
  stats: unknown;
  skills: string[];
  name: string;
  portrait: string;
}

function makePrisma(officers: OfficerRow[], fleetGold = 10000) {
  const world = { id: "w1", userId: "u1" };
  const fleet = { id: "f1", worldId: "w1", guildId: "g1", activity: "DOCKED", dockedPortId: PORT_ID };
  const guilds: Record<string, { id: string; gold: bigint; kind: string }> = {
    g1: { id: "g1", gold: BigInt(fleetGold), kind: "PLAYER" },
  };

  const prisma = {
    gameWorld: { findUnique: jest.fn(async () => world) },
    fleet: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "f1" ? { ...fleet, guild: guilds.g1 } : null,
      ),
      findMany: jest.fn(async () => [
        { ...fleet, guildId: "g1", guild: guilds.g1, officers: officers.filter((o) => o.fleetId === "f1") },
      ]),
    },
    officer: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        officers.find((o) => o.id === where.id) ?? null,
      ),
      findMany: jest.fn(async ({ where }: { where: { locationPortId: string; fleetId: null } }) =>
        officers.filter((o) => o.locationPortId === where.locationPortId && o.fleetId === null),
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<OfficerRow> }) => {
        const officer = officers.find((o) => o.id === where.id)!;
        Object.assign(officer, data);
        return officer;
      }),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { worldId: string; fleetId: string; role: string; NOT: { id: string } };
          data: Partial<OfficerRow>;
        }) => {
          for (const o of officers) {
            if (o.fleetId === where.fleetId && o.role === where.role && o.id !== where.NOT.id) {
              Object.assign(o, data);
            }
          }
        },
      ),
    },
    guild: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { gold: bigint } }) => {
        guilds[where.id].gold = data.gold;
      }),
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
  } as unknown as PrismaService;

  return { prisma, guilds };
}

function officer(overrides: Partial<OfficerRow>): OfficerRow {
  return {
    id: "o1",
    worldId: "w1",
    fleetId: null,
    locationPortId: PORT_ID,
    role: null,
    loyalty: 60,
    salary: 150,
    stats: { lead: 50, nav: 60, combat: 40, trade: 30, lore: 50 },
    skills: [],
    name: "測試航海士",
    portrait: "portrait.test",
    ...overrides,
  };
}

describe("OfficerService.getTavern / recruit", () => {
  it("lists only unassigned officers at the given port", async () => {
    const officers = [
      officer({ id: "o1" }),
      officer({ id: "o2", locationPortId: "port.other" }),
      officer({ id: "o3", fleetId: "f1", locationPortId: null }),
    ];
    const { prisma } = makePrisma(officers);
    const service = new OfficerService(prisma);

    const tavern = await service.getTavern("u1", "w1", PORT_ID);
    expect(tavern.map((o) => o.id)).toEqual(["o1"]);
  });

  it("recruit moves the officer onto the fleet and clears their tavern location", async () => {
    const officers = [officer({ id: "o1" })];
    const { prisma } = makePrisma(officers);
    const service = new OfficerService(prisma);

    const result = await service.recruit("u1", "w1", PORT_ID, "f1", "o1");

    expect(result.recruited).toBe(true);
    expect(officers[0].fleetId).toBe("f1");
    expect(officers[0].locationPortId).toBeNull();
  });

  it("rejects recruiting an officer already on a fleet", async () => {
    const officers = [officer({ id: "o1", fleetId: "f2", locationPortId: null })];
    const { prisma } = makePrisma(officers);
    const service = new OfficerService(prisma);

    await expect(service.recruit("u1", "w1", PORT_ID, "f1", "o1")).rejects.toMatchObject({
      code: "OFFICER_UNAVAILABLE",
    });
  });
});

describe("OfficerService.assignRole", () => {
  it("assigns a role and bumps any prior holder of that role", async () => {
    const officers = [
      officer({ id: "o1", fleetId: "f1", locationPortId: null, role: "NAVIGATOR" }),
      officer({ id: "o2", fleetId: "f1", locationPortId: null, role: null }),
    ];
    const { prisma } = makePrisma(officers);
    const service = new OfficerService(prisma);

    await service.assignRole("u1", "w1", "f1", "o2", { role: "NAVIGATOR" });

    expect(officers.find((o) => o.id === "o2")!.role).toBe("NAVIGATOR");
    expect(officers.find((o) => o.id === "o1")!.role).toBeNull();
  });

  it("clears a role when null is passed", async () => {
    const officers = [officer({ id: "o1", fleetId: "f1", locationPortId: null, role: "GUNNER" })];
    const { prisma } = makePrisma(officers);
    const service = new OfficerService(prisma);

    await service.assignRole("u1", "w1", "f1", "o1", { role: null });
    expect(officers[0].role).toBeNull();
  });
});

describe("OfficerService.paySalariesIfDue", () => {
  it("does nothing off the salary interval", async () => {
    const officers = [officer({ id: "o1", fleetId: "f1", locationPortId: null, salary: 200 })];
    const { prisma, guilds } = makePrisma(officers, 1000);
    const service = new OfficerService(prisma);

    await service.paySalariesIfDue("w1", BALANCE.SALARY_INTERVAL_TICKS - 1);
    expect(Number(guilds.g1.gold)).toBe(1000);
  });

  it("deducts total salary from guild gold when affordable", async () => {
    const officers = [
      officer({ id: "o1", fleetId: "f1", locationPortId: null, salary: 200 }),
      officer({ id: "o2", fleetId: "f1", locationPortId: null, salary: 150 }),
    ];
    const { prisma, guilds } = makePrisma(officers, 1000);
    const service = new OfficerService(prisma);

    await service.paySalariesIfDue("w1", BALANCE.SALARY_INTERVAL_TICKS);
    expect(Number(guilds.g1.gold)).toBe(1000 - 350);
  });

  it("penalizes loyalty instead of going negative when gold is insufficient", async () => {
    const officers = [officer({ id: "o1", fleetId: "f1", locationPortId: null, salary: 200, loyalty: 15 })];
    const { prisma, guilds } = makePrisma(officers, 50);
    const service = new OfficerService(prisma);

    await service.paySalariesIfDue("w1", BALANCE.SALARY_INTERVAL_TICKS);
    expect(Number(guilds.g1.gold)).toBe(50); // 沒扣款
    expect(officers[0].loyalty).toBe(15 - BALANCE.LOYALTY_PENALTY_UNPAID);
  });

  it("a first mate softens the unpaid loyalty penalty for the whole fleet (M23)", async () => {
    const officers = [
      officer({
        id: "fm",
        fleetId: "f1",
        locationPortId: null,
        role: "FIRST_MATE",
        salary: 0,
        loyalty: 60,
        stats: { lead: 100, nav: 0, combat: 0, trade: 0, lore: 0 },
      }),
      officer({ id: "o2", fleetId: "f1", locationPortId: null, salary: 200, loyalty: 60 }),
    ];
    const { prisma, guilds } = makePrisma(officers, 0);
    const service = new OfficerService(prisma);

    await service.paySalariesIfDue("w1", BALANCE.SALARY_INTERVAL_TICKS);
    expect(Number(guilds.g1.gold)).toBe(0); // 沒扣款
    const penalty = 60 - officers[1].loyalty;
    expect(penalty).toBeLessThan(BALANCE.LOYALTY_PENALTY_UNPAID);
    expect(penalty).toBeGreaterThan(0);
  });
});
