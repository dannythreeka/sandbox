import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, type Fleet } from "@prisma/client";
import {
  axialToOddr,
  consumeSupplies,
  findPath,
  fleetSpeed,
  HEXMAP,
  navigatorSpeedBonus,
  oddrToAxial,
  portById,
  RouteViewSchema,
  shipClassById,
  stepAlongRoute,
  type FleetTickDelta,
  type Route,
  type ServerArrivalPayload,
  type ServerTickPayload,
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
   * 設定航線（M2 簡化：前端只送目的港，後端用 shared A* 算出權威航線；
   * docs/04 原設計是前端先跑預覽、送 waypoints 給後端驗證，等 M2+ 前端 Pixi 預覽上線後補上）。
   */
  async setRoute(userId: string, worldId: string, fleetId: string, targetPortId: string) {
    const fleet = await this.getOwnedPlayerFleet(userId, worldId, fleetId);
    if (NON_ROUTABLE_ACTIVITIES.has(fleet.activity)) throw new GameError("FLEET_BUSY");

    const targetPort = portById(targetPortId); // throws if unknown id (content bug, not user input issue)
    const start = fleet.activity === "DOCKED" && fleet.dockedPortId
      ? portById(fleet.dockedPortId).coord
      : axialToOddr({ q: fleet.posQ, r: fleet.posR });

    const path = findPath(HEXMAP, start, targetPort.coord);
    if (!path) throw new GameError("ROUTE_INVALID");

    const route: Route = { waypoints: path, cursor: 0, targetPortId };
    await this.prisma.fleet.update({
      where: { id: fleet.id },
      data: { route: route as unknown as Prisma.InputJsonValue },
    });
    return RouteViewSchema.parse(route);
  }

  async depart(userId: string, worldId: string, fleetId: string) {
    const fleet = await this.getOwnedPlayerFleet(userId, worldId, fleetId);
    if (fleet.activity !== "DOCKED") throw new GameError("FLEET_BUSY");

    const route = fleet.route as Route | null;
    if (!route || route.waypoints.length < 2) throw new GameError("NO_ROUTE_SET");

    await this.prisma.fleet.update({
      where: { id: fleet.id },
      data: { activity: "SAILING", dockedPortId: null },
    });
    return { departed: true };
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
      const arrived = step.arrived && route.targetPortId !== undefined;

      await this.prisma.fleet.update({
        where: { id: fleet.id },
        data: {
          posQ: newPos.q,
          posR: newPos.r,
          food: supplies.food,
          water: supplies.water,
          morale: supplies.morale,
          activity: arrived ? "DOCKED" : "SAILING",
          dockedPortId: arrived ? route.targetPortId : null,
          route: arrived
            ? Prisma.DbNull
            : ({ ...route, cursor: step.cursor } as unknown as Prisma.InputJsonValue),
        },
      });

      if (arrived) {
        arrivals.push({
          worldId,
          payload: { tick: newTick, fleetId: fleet.id, portId: route.targetPortId! },
        });
      }

      deltas.push({
        id: fleet.id,
        pos: newPos,
        activity: arrived ? "DOCKED" : "SAILING",
        dockedPortId: arrived ? route.targetPortId! : null,
        food: supplies.food,
        water: supplies.water,
        morale: supplies.morale,
      });
    }

    await this.prisma.gameWorld.update({ where: { id: worldId }, data: { currentTick: newTick } });

    const tickPayload: ServerTickPayload = { tick: newTick, fleets: deltas, notices: [] };
    this.events.emit(WORLD_TICK_EVENT, { worldId, payload: tickPayload } satisfies WorldTickEventPayload);
    for (const arrival of arrivals) {
      this.events.emit(WORLD_ARRIVAL_EVENT, arrival);
    }
    return tickPayload;
  }
}
