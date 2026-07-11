import type { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, type Fleet } from "@prisma/client";
import {
  BALANCE,
  firstNavigableHeading,
  HEXMAP,
  hexDirectionBetween,
  hexNeighbors,
  HOME_PORT_ID,
  isNavigable,
  oddrToAxial,
  portAtCoord,
  portById,
  TERRAIN,
  terrainAt,
  type OffsetCoord,
  type ServerTickPayload,
  type WindDirection,
} from "@azure-voyage/shared";
import type { PrismaService } from "../../prisma/prisma.service";
import { VoyageService, WORLD_ARRIVAL_EVENT, WORLD_TICK_EVENT } from "./voyage.service";

const NORTH_PORT_ID = "port.north_reach.valdren"; // 距首都較近的一個港口，供路徑測試

/** 在指定座標附近找一個符合條件的格子（掃固定範圍，內容地圖不變則結果確定） */
function findHexNear(origin: OffsetCoord, ok: (c: OffsetCoord) => boolean): OffsetCoord {
  for (let radius = 1; radius <= 10; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const c = { col: origin.col + dc, row: origin.row + dr };
        if (ok(c)) return c;
      }
    }
  }
  throw new Error("test setup: no hex matching predicate near origin");
}

/** 掃地圖找一個「可航行格緊鄰陸地」的組合，回傳起點與指向陸地的航向（M12 撞陸測試用）。 */
function findLandApproach(): { start: OffsetCoord; heading: WindDirection } {
  for (let row = 0; row < HEXMAP.height; row++) {
    for (let col = 0; col < HEXMAP.width; col++) {
      if (terrainAt(HEXMAP, { col, row }) !== TERRAIN.LAND) continue;
      for (const n of hexNeighbors({ col, row })) {
        if (!isNavigable(terrainAt(HEXMAP, n))) continue;
        const heading = hexDirectionBetween(n, { col, row });
        if (heading !== null) return { start: n, heading };
      }
    }
  }
  throw new Error("test setup: no land approach found");
}

function makeFleet(overrides: Partial<Fleet> = {}): Fleet {
  const home = oddrToAxial(portById(HOME_PORT_ID).coord);
  return {
    id: "f1",
    worldId: "w1",
    guildId: "g1",
    name: "第一艦隊",
    activity: "DOCKED",
    posQ: home.q,
    posR: home.r,
    dockedPortId: HOME_PORT_ID,
    route: null,
    food: 30,
    water: 30,
    morale: 70,
    speedCarry: 0,
    heading: null,
    ...overrides,
  } as Fleet;
}

function makePrismaMock(state: {
  fleet: Fleet;
  world?: { currentTick: number; status: string };
  guild?: { gold: bigint };
}) {
  const world = state.world ?? { currentTick: 0, status: "ACTIVE" };
  const guild = state.guild ?? { gold: 10000n };
  const ships = [{ id: "s1", fleetId: state.fleet.id, shipClassId: "ship.lugger", crew: 8 }];
  const prisma = {
    gameWorld: {
      findUnique: jest.fn(async () => ({ id: "w1", userId: "u1", seed: 4242, ...world })),
      findUniqueOrThrow: jest.fn(async () => ({ id: "w1", userId: "u1", seed: 4242, ...world })),
      update: jest.fn(async ({ data }: { data: { currentTick: number } }) => {
        world.currentTick = data.currentTick;
        return { id: "w1", ...world };
      }),
    },
    guild: {
      findUniqueOrThrow: jest.fn(async () => ({ id: "g1", kind: "PLAYER", ...guild })),
      update: jest.fn(async ({ data }: { data: { gold: bigint } }) => {
        guild.gold = data.gold;
        return { id: "g1", ...guild };
      }),
    },
    fleet: {
      findUnique: jest.fn(async () => ({ ...state.fleet, guild: { kind: "PLAYER" } })),
      findMany: jest.fn(async () =>
        state.fleet.activity === "SAILING" ? [{ ...state.fleet, ships, officers: [] }] : [],
      ),
      update: jest.fn(async ({ data }: { data: Partial<Fleet> }) => {
        // 真實 Prisma 只會更新 data 內出現的欄位；純 JS mock 需自行還原這個語意，
        // 否則 depart() 這類「沒帶 route 欄位」的 update 會把 route 誤蓋成 undefined。
        const normalized = { ...data };
        if ("route" in data) {
          normalized.route = (data.route as unknown) === Prisma.DbNull ? null : data.route;
        }
        Object.assign(state.fleet, normalized);
        return state.fleet;
      }),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;
  return { prisma, guild };
}

function makeEventsMock() {
  const emitted: { event: string; payload: unknown }[] = [];
  return {
    emitted,
    events: { emit: (event: string, payload: unknown) => emitted.push({ event, payload }) } as unknown as EventEmitter2,
  };
}

describe("VoyageService.setRoute", () => {
  it("computes a valid route from the docked port to the target port", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    const route = await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });

    expect(route.targetPortId).toBe(NORTH_PORT_ID);
    expect(route.waypoints[0]).toEqual(portById(HOME_PORT_ID).coord);
    expect(route.waypoints[route.waypoints.length - 1]).toEqual(portById(NORTH_PORT_ID).coord);
    expect(route.cursor).toBe(0);
  });

  it("rejects setting a route while in battle", async () => {
    const fleet = makeFleet({ activity: "IN_BATTLE" });
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    await expect(service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID })).rejects.toMatchObject({
      code: "FLEET_BUSY",
    });
  });
});

describe("VoyageService.depart", () => {
  it("requires a route to be set first", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    await expect(service.depart("u1", "w1", "f1")).rejects.toMatchObject({ code: "NO_ROUTE_SET" });
  });

  it("requires the fleet to be docked", async () => {
    const fleet = makeFleet({ activity: "SAILING" });
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    await expect(service.depart("u1", "w1", "f1")).rejects.toMatchObject({ code: "FLEET_BUSY" });
  });

  it("transitions DOCKED -> SAILING once a route exists", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });

    const result = await service.depart("u1", "w1", "f1");

    expect(result.departed).toBe(true);
    expect(fleet.activity).toBe("SAILING");
    expect(fleet.dockedPortId).toBeNull();
  });

  it("auto-resupplies food and water to full on depart, charging the guild", async () => {
    const fleet = makeFleet({ food: 10, water: 4 });
    const { prisma, guild } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });

    const result = await service.depart("u1", "w1", "f1");

    // 缺 20 糧 + 26 水 = 46 單位 × 2 金
    expect(result.resupplied).toEqual({ food: 20, water: 26, cost: 92 });
    expect(fleet.food).toBe(BALANCE.STARTING_FOOD);
    expect(fleet.water).toBe(BALANCE.STARTING_WATER);
    expect(guild.gold).toBe(BigInt(10000 - 92));
  });

  it("resupplies only what the guild can afford when gold is short", async () => {
    const fleet = makeFleet({ food: 0, water: 0 });
    const { prisma, guild } = makePrismaMock({ fleet, guild: { gold: 60n } });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });

    const result = await service.depart("u1", "w1", "f1");

    // 全額要 120 金、只有 60 金 → 比例 0.5：各補 15，花 60；照樣能出港
    expect(result.resupplied).toEqual({ food: 15, water: 15, cost: 60 });
    expect(fleet.activity).toBe("SAILING");
    expect(guild.gold).toBe(0n);
  });
});

describe("VoyageService.advanceOneTick", () => {
  it("moves a sailing fleet, consumes supplies, and emits a tick event", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events, emitted } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });
    await service.depart("u1", "w1", "f1");

    const before = { food: fleet.food, water: fleet.water };
    const result = await service.advanceOneTick("w1");

    expect(result.tick).toBe(1);
    expect(fleet.food).toBeLessThan(before.food);
    expect(fleet.water).toBeLessThan(before.water);
    expect(emitted.some((e) => e.event === WORLD_TICK_EVENT)).toBe(true);
  });

  it("docks the fleet and emits an arrival event once the route completes", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events, emitted } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });
    await service.depart("u1", "w1", "f1");

    // 跑足夠多 tick 直到抵達（安全上限防止測試死迴圈）
    for (let i = 0; i < 200 && fleet.activity === "SAILING"; i++) {
      await service.advanceOneTick("w1");
    }

    expect(fleet.activity).toBe("DOCKED");
    expect(fleet.dockedPortId).toBe(NORTH_PORT_ID);
    expect(fleet.route).toBeNull();
    expect(emitted.some((e) => e.event === WORLD_ARRIVAL_EVENT)).toBe(true);
  });

  it("reports the daily wind in each sailing fleet's tick delta (M11)", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });
    await service.depart("u1", "w1", "f1");

    const result = await service.advanceOneTick("w1");
    const mine = result.fleets.find((f) => f.id === "f1")!;

    expect(mine.wind).toBeDefined();
    expect(mine.wind!.dir).toBeGreaterThanOrEqual(0);
    expect(mine.wind!.dir).toBeLessThanOrEqual(5);
    expect([...BALANCE.WIND_MODIFIERS]).toContain(mine.wind!.modifier);
  });

  it("reports the daily weather in each sailing fleet's tick delta (M14)", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });
    await service.depart("u1", "w1", "f1");

    const result = await service.advanceOneTick("w1");
    const mine = result.fleets.find((f) => f.id === "f1")!;

    expect(mine.weather).toBeDefined();
    expect(["CLEAR", "BREEZE", "FOG", "STORM_BREWING"]).toContain(mine.weather);
  });

  it("keeps speedCarry finite and bounded across many ticks (M11)", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });
    await service.depart("u1", "w1", "f1");

    for (let i = 0; i < 60 && fleet.activity === "SAILING"; i++) {
      await service.advanceOneTick("w1");
      expect(Number.isFinite(fleet.speedCarry)).toBe(true);
      expect(fleet.speedCarry).toBeGreaterThanOrEqual(0);
      // carry 上限 = max(基礎船速, 暗礁成本 3)；lugger 基礎 3
      expect(fleet.speedCarry).toBeLessThanOrEqual(3);
    }
    expect(fleet.speedCarry).toBe(0); // 抵港歸零
  });

  it("never lets food or water go negative across many ticks", async () => {
    const fleet = makeFleet({ food: 3, water: 3 });
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });
    await service.depart("u1", "w1", "f1");

    for (let i = 0; i < 50 && fleet.activity === "SAILING"; i++) {
      await service.advanceOneTick("w1");
      expect(fleet.food).toBeGreaterThanOrEqual(0);
      expect(fleet.water).toBeGreaterThanOrEqual(0);
      expect(fleet.morale).toBeGreaterThanOrEqual(0);
      expect(fleet.morale).toBeLessThanOrEqual(100);
    }
  });
});

describe("free sailing (sea-hex target)", () => {
  const homeCoord = portById(HOME_PORT_ID).coord;
  const openSea = findHexNear(homeCoord, (c) => {
    const t = terrainAt(HEXMAP, c);
    return isNavigable(t) && t !== TERRAIN.PORT && portAtCoord(c) === undefined;
  });

  it("sets a route to an arbitrary navigable sea hex with no target port", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    const route = await service.setRoute("u1", "w1", "f1", { target: openSea });

    expect(route.targetPortId).toBeUndefined();
    expect(route.waypoints[route.waypoints.length - 1]).toEqual(openSea);
  });

  it("atomically weighs anchor when setting a course while ANCHORED", async () => {
    const anchorAxial = oddrToAxial(openSea);
    const fleet = makeFleet({
      activity: "ANCHORED",
      dockedPortId: null,
      posQ: anchorAxial.q,
      posR: anchorAxial.r,
    });
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    await service.setRoute("u1", "w1", "f1", { targetPortId: HOME_PORT_ID });

    // 單一請求內完成「存航線 + 收錨」，不能靠第二個 toggle 請求（會有競態）
    expect(fleet.activity).toBe("SAILING");
    expect(fleet.route).not.toBeNull();
  });

  it("treats a sea target that lands on a port hex as sailing to that port", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    const route = await service.setRoute("u1", "w1", "f1", {
      target: portById(NORTH_PORT_ID).coord,
    });

    expect(route.targetPortId).toBe(NORTH_PORT_ID);
  });

  it("rejects a sea target on land", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    const land = findHexNear(homeCoord, (c) => terrainAt(HEXMAP, c) === TERRAIN.LAND);

    await expect(service.setRoute("u1", "w1", "f1", { target: land })).rejects.toMatchObject({
      code: "ROUTE_INVALID",
    });
  });

  it("rejects an unknown target port id as ROUTE_INVALID instead of crashing", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    await expect(
      service.setRoute("u1", "w1", "f1", { targetPortId: "port.nowhere.fake" }),
    ).rejects.toMatchObject({ code: "ROUTE_INVALID" });
  });

  it("anchors at sea (not docks) when the free-sail route completes, with a notice", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events, emitted } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { target: openSea });
    await service.depart("u1", "w1", "f1");

    let lastTick: ServerTickPayload | null = null;
    for (let i = 0; i < 200 && fleet.activity === "SAILING"; i++) {
      lastTick = await service.advanceOneTick("w1");
    }

    expect(fleet.activity).toBe("ANCHORED");
    expect(fleet.dockedPortId).toBeNull();
    expect(fleet.route).toBeNull();
    expect(oddrToAxial(openSea)).toEqual({ q: fleet.posQ, r: fleet.posR });
    expect(emitted.some((e) => e.event === WORLD_ARRIVAL_EVENT)).toBe(false);
    expect(lastTick?.notices.some((n) => n.includes("下錨"))).toBe(true);
  });
});

describe("VoyageService.setHeading (M12 manual steering)", () => {
  const homeCoord = portById(HOME_PORT_ID).coord;
  const heading = firstNavigableHeading(HEXMAP, homeCoord)!;

  it("sets a manual heading and clears any stored route atomically", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });

    const result = await service.setHeading("u1", "w1", "f1", heading);

    expect(result.heading).toBe(heading);
    expect(fleet.heading).toBe(heading);
    expect(fleet.route).toBeNull(); // 互斥：設航向即清航線
  });

  it("setRoute clears any stored heading atomically (mutual exclusivity both ways)", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setHeading("u1", "w1", "f1", heading);

    await service.setRoute("u1", "w1", "f1", { targetPortId: NORTH_PORT_ID });

    expect(fleet.heading).toBeNull();
  });

  it("rejects steering while in battle", async () => {
    const fleet = makeFleet({ activity: "IN_BATTLE" });
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    await expect(service.setHeading("u1", "w1", "f1", heading)).rejects.toMatchObject({
      code: "FLEET_BUSY",
    });
  });

  it("atomically weighs anchor when steering while ANCHORED", async () => {
    const anchorAxial = oddrToAxial(homeCoord);
    const fleet = makeFleet({ activity: "ANCHORED", dockedPortId: null, posQ: anchorAxial.q, posR: anchorAxial.r });
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    await service.setHeading("u1", "w1", "f1", heading);

    expect(fleet.activity).toBe("SAILING");
    expect(fleet.heading).toBe(heading);
  });

  it("departs on a manual heading with no route set (M12 relaxes NO_ROUTE_SET)", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setHeading("u1", "w1", "f1", heading);

    const result = await service.depart("u1", "w1", "f1");

    expect(result.departed).toBe(true);
    expect(fleet.activity).toBe("SAILING");
  });

  it("resuming from ANCHORED without a route or heading is rejected", async () => {
    const fleet = makeFleet({ activity: "ANCHORED", dockedPortId: null, route: null, heading: null });
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);

    await expect(service.toggleAnchor("u1", "w1", "f1")).rejects.toMatchObject({
      code: "NO_ROUTE_SET",
    });
  });
});

describe("VoyageService.advanceOneTick (M12 manual heading movement)", () => {
  const homeCoord = portById(HOME_PORT_ID).coord;
  const heading = firstNavigableHeading(HEXMAP, homeCoord)!;

  it("moves the fleet along the fixed heading each tick, reporting wind and heading in the delta", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setHeading("u1", "w1", "f1", heading);
    await service.depart("u1", "w1", "f1");

    const before = { q: fleet.posQ, r: fleet.posR };
    const result = await service.advanceOneTick("w1");
    const mine = result.fleets.find((f) => f.id === "f1")!;

    expect(fleet.posQ === before.q && fleet.posR === before.r).toBe(false); // 位置有變
    expect(mine.wind).toBeDefined();
    // 尚在航行中才會回報 heading；若這一步剛好開進港口，heading 會被清空，
    // 兩種結果都是合法的，只要沒有拋錯即可（見下面專門測試撞陸/入港分支）。
    if (fleet.activity === "SAILING") expect(mine.heading).toBe(heading);
  });

  it("auto-anchors and clears heading when the fixed heading runs into land", async () => {
    const { start, heading: intoLand } = findLandApproach();
    const startAxial = oddrToAxial(start);
    const fleet = makeFleet({ posQ: startAxial.q, posR: startAxial.r, dockedPortId: null });
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setHeading("u1", "w1", "f1", intoLand);
    await service.depart("u1", "w1", "f1");

    let lastTick: ServerTickPayload | null = null;
    for (let i = 0; i < 20 && fleet.activity === "SAILING"; i++) {
      lastTick = await service.advanceOneTick("w1");
    }

    expect(fleet.activity).toBe("ANCHORED");
    expect(fleet.heading).toBeNull();
    expect(lastTick?.notices.some((n) => n.includes("陸地"))).toBe(true);
  });

  it("keeps speedCarry finite and bounded in manual mode too", async () => {
    const fleet = makeFleet();
    const { prisma } = makePrismaMock({ fleet });
    const { events } = makeEventsMock();
    const service = new VoyageService(prisma, events);
    await service.setHeading("u1", "w1", "f1", heading);
    await service.depart("u1", "w1", "f1");

    for (let i = 0; i < 30 && fleet.activity === "SAILING"; i++) {
      await service.advanceOneTick("w1");
      expect(Number.isFinite(fleet.speedCarry)).toBe(true);
      expect(fleet.speedCarry).toBeGreaterThanOrEqual(0);
    }
  });
});
