import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  axialToOddr,
  BALANCE,
  deriveSeed,
  PORTS,
  regionForCoord,
  Rng,
  shipClassById,
  type ServerEventPayload,
} from "@azure-voyage/shared";
import { PrismaService } from "../../prisma/prisma.service";

export const WORLD_EVENT_EMITTED = "world.event";

/** 風暴與港口慶典（docs/01 §4.7、docs/05 §1 PHASE 1/4）：規則型事件，不含 AI。 */
@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** 每 tick 為航行中艦隊擲骰是否遇上風暴（獨立於海賊遭遇的另一條隨機流）。 */
  async rollStorms(worldId: string, tick: number): Promise<void> {
    const world = await this.prisma.gameWorld.findUniqueOrThrow({ where: { id: worldId } });
    const sailingFleets = await this.prisma.fleet.findMany({
      where: { worldId, activity: "SAILING" },
      include: { ships: true },
    });

    for (const fleet of sailingFleets) {
      const rng = new Rng(deriveSeed(world.seed, tick, hashId(fleet.id), 0x5701));
      const region = regionForCoord(axialToOddr({ q: fleet.posQ, r: fleet.posR }));
      const chance = region.danger * BALANCE.STORM_CHANCE_PER_DANGER;
      if (!rng.chance(chance)) continue;

      for (const ship of fleet.ships) {
        const maxHull = shipClassById(ship.shipClassId).maxHull;
        const damage = Math.round(maxHull * BALANCE.STORM_HULL_DAMAGE_RATIO);
        await this.prisma.ship.update({
          where: { id: ship.id },
          data: { hull: Math.max(1, ship.hull - damage) },
        });
      }
      await this.prisma.fleet.update({
        where: { id: fleet.id },
        data: {
          food: Math.max(0, fleet.food - BALANCE.STORM_SUPPLY_LOSS),
          water: Math.max(0, fleet.water - BALANCE.STORM_SUPPLY_LOSS),
        },
      });

      const narrative = `一場突如其來的風暴襲擊了艦隊，船體受損、補給流失。`;
      await this.prisma.worldEvent.create({
        data: {
          worldId,
          source: "RULE",
          type: "STORM",
          status: "RESOLVED",
          triggerTick: tick,
          payload: { fleetId: fleet.id },
          narrative,
        },
      });

      const payload: ServerEventPayload = {
        tick,
        fleetId: fleet.id,
        event: { id: fleet.id, type: "STORM", narrative },
      };
      this.events.emit(WORLD_EVENT_EMITTED, { worldId, payload });
    }
  }

  /** 每 FESTIVAL_INTERVAL_TICKS 隨機挑一個港口舉辦慶典，繁榮度暫時提升。 */
  async rollFestivals(worldId: string, tick: number): Promise<void> {
    if (tick % BALANCE.FESTIVAL_INTERVAL_TICKS !== 0) return;
    const world = await this.prisma.gameWorld.findUniqueOrThrow({ where: { id: worldId } });
    const eligible = PORTS.filter((p) => p.size >= 2);
    const rng = new Rng(deriveSeed(world.seed, tick, 0xfe57));
    const port = rng.pick(eligible);

    const portState = await this.prisma.portState.findUnique({
      where: { worldId_portId: { worldId, portId: port.id } },
    });
    if (!portState) return;

    await this.prisma.portState.update({
      where: { id: portState.id },
      data: { prosperity: portState.prosperity + BALANCE.FESTIVAL_PROSPERITY_BOOST },
    });

    const narrative = `${port.name}正舉辦盛大慶典，市集熱鬧非凡，繁榮度暫時提升。`;
    await this.prisma.worldEvent.create({
      data: {
        worldId,
        source: "RULE",
        type: "FESTIVAL",
        status: "ACTIVE",
        triggerTick: tick,
        expireTick: tick + BALANCE.FESTIVAL_DURATION_TICKS,
        payload: { portId: port.id, boost: BALANCE.FESTIVAL_PROSPERITY_BOOST },
        narrative,
      },
    });

    const payload: ServerEventPayload = {
      tick,
      event: { id: portState.id, type: "FESTIVAL", narrative, portId: port.id },
    };
    this.events.emit(WORLD_EVENT_EMITTED, { worldId, payload });
  }

  /** 慶典到期後撤銷繁榮度加成（docs/05 §1）。 */
  async expireFestivals(worldId: string, tick: number): Promise<void> {
    const due = await this.prisma.worldEvent.findMany({
      where: { worldId, type: "FESTIVAL", status: "ACTIVE", expireTick: { lte: tick } },
    });
    for (const event of due) {
      const payload = event.payload as { portId: string; boost: number };
      const portState = await this.prisma.portState.findUnique({
        where: { worldId_portId: { worldId, portId: payload.portId } },
      });
      if (portState) {
        await this.prisma.portState.update({
          where: { id: portState.id },
          data: { prosperity: Math.max(0, portState.prosperity - payload.boost) },
        });
      }
      await this.prisma.worldEvent.update({ where: { id: event.id }, data: { status: "EXPIRED" } });
    }
  }
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
