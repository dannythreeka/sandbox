import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, type Fleet } from "@prisma/client";
import {
  axialToOddr,
  BALANCE,
  consumeSupplies,
  findPath,
  fleetSpeed,
  HEXMAP,
  navigatorSpeedBonus,
  oddrToAxial,
  portAtCoord,
  portById,
  PORTS,
  RouteViewSchema,
  shipClassById,
  stepAlongRoute,
  type FleetTickDelta,
  type Route,
  type ServerArrivalPayload,
  type ServerTickPayload,
  type SetRouteInput,
} from "@azure-voyage/shared";
import { GameError } from "../../common/errors/game-error";
import { PrismaService } from "../../prisma/prisma.service";

export const WORLD_TICK_EVENT = "world.tick";
export const WORLD_ARRIVAL_EVENT = "world.arrival";

export interface WorldTickEventPayload {
  worldId: string;
  payload: ServerTickPayload;
}
export interface WorldArrivalEventPayload {
  worldId: string;
  payload: ServerArrivalPayload;
}

const NON_ROUTABLE_ACTIVITIES = new Set(["IN_BATTLE", "EXPLORING"]);

@Injectable()
export class VoyageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EventEmitter2) private readonly events: EventEmitter2,
  ) {}

  /** 世界+玩家艦隊的所有權檢查，一次做完（docs/02 §6）。 */
  async getOwnedPlayerFleet(userId: string, worldId: string, fleetId: string): Promise<Fleet> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      include: { guild: true },
    });
    if (!fleet || fleet.worldId !== worldId || fleet.guild.kind !== "PLAYER") {
      throw new GameError("NOT_FOUND");
    }
    return fleet;
  }

  /**
   * 設定航線。目的地可以是港口（targetPortId）或任一可航行海格（target，自由航行）；
   * 兩者都由後端以 shared A* 算出權威航線。自由航行的目標若剛好是港口格，
   * 視同指定該港（抵達即入港，而非在港外下錨）。
   */
  async setRoute(userId: string, worldId: string, fleetId: string, input: SetRouteInput) {
    const fleet = await this.getOwnedPlayerFleet(userId, worldId, fleetId);
    if (NON_ROUTABLE_ACTIVITIES.has(fleet.activity)) throw new GameError("FLEET_BUSY");

    let goal: { col: number; row: number };
    let targetPortId: string | undefined;
    if (input.targetPortId !== undefined) {
      const targetPort = PORTS.find((p) => p.id === input.targetPortId);
      if (!targetPort) throw new GameError("ROUTE_INVALID"); // 未知港口 id 屬使用者輸入問題
      goal = targetPort.coord;
      targetPortId = targetPort.id;
    } else {
      goal = input.target!;
      targetPortId = portAtCoord(goal)?.id;
    }

    const start = fleet.activity === "DOCKED" && fleet.dockedPortId
      ? portById(fleet.dockedPortId).coord
      : axialToOddr({ q: fleet.posQ, r: fleet.posR });

    const path = findPath(HEXMAP, start, goal);
    if (!path) throw new GameError("ROUTE_INVALID");

    const route: Route = { waypoints: path, cursor: 0, targetPortId };
    await this.prisma.fleet.update({
      where: { id: fleet.id },
      data: {
        route: route as unknown as Prisma.InputJsonValue,
        // 海上下錨中設定新航向＝收錨啟航，與存航線做成同一次原子更新。
        // （拆成 setRoute + toggleAnchor 兩個請求會有競態：重複點擊可能把錨
        // 切回去，艦隊被錨死但前端樂觀顯示航行中，時間就這樣空轉。）
        ...(fleet.activity === "ANCHORED" ? { activity: "SAILING" as const } : {}),
      },
    });
    return RouteViewSchema.parse(route);
  }

  async depart(userId: string, worldId: string, fleetId: string) {
    const fleet = await this.getOwnedPlayerFleet(userId, worldId, fleetId);
    if (fleet.activity !== "DOCKED") throw new GameError("FLEET_BUSY");

    const route = fleet.route as Route | null;
    if (!route || route.waypoints.length < 2) throw new GameError("NO_ROUTE_SET");

    // 出港前自動補給（M10）：糧水補到滿、按單價扣商會資金；資金不足就按
    // 可負擔比例補（不擋出港——空著肚子也能啟航，風險自負）。沒有這個機制
    // 補給只會一路遞減，玩家海上漫遊幾天後就永遠斷糧。
    const guild = await this.prisma.guild.findUniqueOrThrow({ where: { id: fleet.guildId } });
    const gold = Number(guild.gold);
    const foodNeed = Math.max(0, BALANCE.STARTING_FOOD - fleet.food);
    const waterNeed = Math.max(0, BALANCE.STARTING_WATER - fleet.water);
    const fullCost = (foodNeed + waterNeed) * BALANCE.SUPPLY_GOLD_PER_UNIT;
    const ratio = fullCost === 0 ? 0 : Math.min(1, gold / fullCost);
    const foodBuy = Math.floor(foodNeed * ratio);
    const waterBuy = Math.floor(waterNeed * ratio);
    const cost = (foodBuy + waterBuy) * BALANCE.SUPPLY_GOLD_PER_UNIT;

    await this.prisma.$transaction(async (tx) => {
      if (cost > 0) {
        await tx.guild.update({ where: { id: guild.id }, data: { gold: BigInt(gold - cost) } });
      }
      await tx.fleet.update({
        where: { id: fleet.id },
        data: {
          activity: "SAILING",
          dockedPortId: null,
          food: fleet.food + foodBuy,
          water: fleet.water + waterBuy,
        },
      });
    });
    return { departed: true, resupplied: { food: foodBuy, water: waterBuy, cost } };
  }

  /** 海上下錨／收錨（docs/04 §3）：ANCHORED 艦隊暫停移動與遭遇，供探索使用。 */
  async toggleAnchor(userId: string, worldId: string, fleetId: string) {
    const fleet = await this.getOwnedPlayerFleet(userId, worldId, fleetId);
    if (fleet.activity !== "SAILING" && fleet.activity !== "ANCHORED") {
      throw new GameError("FLEET_BUSY");
    }
    const activity = fleet.activity === "SAILING" ? "ANCHORED" : "SAILING";
    await this.prisma.fleet.update({ where: { id: fleet.id }, data: { activity } });
    return { activity };
  }

  /**
   * 單一 tick 的航行推進（docs/05 §1 PHASE 2/3/9 的 M2 子集）。
   * 供 BullMQ processor 呼叫；完成後以 domain event 廣播，讓 gateway 決定怎麼推播。
   */
  async advanceOneTick(worldId: string): Promise<ServerTickPayload> {
    const world = await this.prisma.gameWorld.findUniqueOrThrow({ where: { id: worldId } });
    const sailingFleets = await this.prisma.fleet.findMany({
      where: { worldId, activity: "SAILING" },
      include: { ships: true, officers: true },
    });

    const deltas: FleetTickDelta[] = [];
    const arrivals: WorldArrivalEventPayload[] = [];
    const notices: string[] = [];
    const newTick = world.currentTick + 1;

    for (const fleet of sailingFleets) {
      const route = fleet.route as Route | null;
      if (!route || route.waypoints.length < 2) continue; // 資料異常防呆，不應發生

      const slowest = Math.min(...fleet.ships.map((s) => shipClassById(s.shipClassId).speed));
      const totalCrew = fleet.ships.reduce((acc, s) => acc + s.crew, 0);
      const navigator = fleet.officers.find((o) => o.role === "NAVIGATOR");
      const navStats = navigator?.stats as { nav: number } | undefined;
      const navBonus = navigatorSpeedBonus(navStats?.nav);

      const step = stepAlongRoute(HEXMAP, route, fleetSpeed(slowest, navBonus));
      const supplies = consumeSupplies(
        { food: fleet.food, water: fleet.water, morale: fleet.morale },
        totalCrew,
      );
      const newPos = oddrToAxial(step.pos);
      // 抵達終點：有目的港 → 入港；自由航行（無目的港）→ 原地下錨，銜接探索
      const arrivedPort = step.arrived && route.targetPortId !== undefined;
      const anchoredAtSea = step.arrived && route.targetPortId === undefined;
      const activity = arrivedPort ? "DOCKED" : anchoredAtSea ? "ANCHORED" : "SAILING";

      await this.prisma.fleet.update({
        where: { id: fleet.id },
        data: {
          posQ: newPos.q,
          posR: newPos.r,
          food: supplies.food,
          water: supplies.water,
          morale: supplies.morale,
          activity,
          dockedPortId: arrivedPort ? route.targetPortId : null,
          route: step.arrived
            ? Prisma.DbNull
            : ({ ...route, cursor: step.cursor } as unknown as Prisma.InputJsonValue),
        },
      });

      if (arrivedPort) {
        arrivals.push({
          worldId,
          payload: { tick: newTick, fleetId: fleet.id, portId: route.targetPortId! },
        });
      }
      if (anchoredAtSea) {
        notices.push(`「${fleet.name}」已抵達目標海域，下錨待命。`);
      }

      deltas.push({
        id: fleet.id,
        pos: newPos,
        activity,
        dockedPortId: arrivedPort ? route.targetPortId! : null,
        food: supplies.food,
        water: supplies.water,
        morale: supplies.morale,
      });
    }

    await this.prisma.gameWorld.update({ where: { id: worldId }, data: { currentTick: newTick } });

    const tickPayload: ServerTickPayload = { tick: newTick, fleets: deltas, notices };
    this.events.emit(WORLD_TICK_EVENT, { worldId, payload: tickPayload } satisfies WorldTickEventPayload);
    for (const arrival of arrivals) {
      this.events.emit(WORLD_ARRIVAL_EVENT, arrival);
    }
    return tickPayload;
  }
}
