import { Injectable } from "@nestjs/common";
import {
  axialToOddr,
  BALANCE,
  deriveSeed,
  discoveryById,
  DISCOVERIES,
  explorationSuccessChance,
  offsetDistance,
  portById,
  regionForCoord,
  Rng,
  weatherAtTick,
  weatherExplorationMult,
  type DiscoveryRecordView,
  type ExploreResult,
  type RegisterDiscoveryResult,
} from "@azure-voyage/shared";
import { GameError } from "../../common/errors/game-error";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async explore(userId: string, worldId: string, fleetId: string): Promise<ExploreResult> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    return this.prisma.$transaction(async (tx) => {
      const fleet = await tx.fleet.findUnique({
        where: { id: fleetId },
        include: { guild: true, officers: true },
      });
      if (!fleet || fleet.worldId !== worldId || fleet.guild.kind !== "PLAYER") {
        throw new GameError("NOT_FOUND");
      }
      if (fleet.activity !== "ANCHORED") throw new GameError("FLEET_BUSY");

      const pos = axialToOddr({ q: fleet.posQ, r: fleet.posR });
      const alreadyFound = await tx.discoveryRecord.findMany({ where: { worldId } });
      const foundIds = new Set(alreadyFound.map((d) => d.discoveryId));
      const target = DISCOVERIES.filter((d) => !foundIds.has(d.id)).find(
        (d) => offsetDistance(pos, d.coord) <= BALANCE.EXPLORE_RADIUS,
      );
      if (!target) throw new GameError("NOT_NEAR_DISCOVERY_SITE");

      await tx.fleet.update({
        where: { id: fleet.id },
        data: {
          food: Math.max(0, fleet.food - BALANCE.EXPLORE_FOOD_COST),
          water: Math.max(0, fleet.water - BALANCE.EXPLORE_WATER_COST),
        },
      });

      const bestLore = fleet.officers.reduce((max, o) => {
        const stats = o.stats as { lore: number };
        return Math.max(max, stats.lore);
      }, 10);
      // M14：起霧降低探索成功率（同一套天氣管線，與遭遇率加成互為對照）。
      const region = regionForCoord(pos);
      const weather = weatherAtTick(region.id, world.currentTick, world.seed);
      const chance = explorationSuccessChance(bestLore, target.requiredLore) * weatherExplorationMult(weather);
      const rng = new Rng(
        deriveSeed(world.seed, world.currentTick, hashId(fleetId), hashId(target.id)),
      );

      if (!rng.chance(chance)) {
        return { success: false, narrative: `這次的探索沒有斬獲，只能悻悻然返航。` };
      }

      await tx.discoveryRecord.create({
        data: { worldId, discoveryId: target.id, foundTick: world.currentTick },
      });
      return {
        success: true,
        discoveryId: target.id,
        name: target.name,
        narrative: `艦隊發現了「${target.name}」！記得回港口向學會登錄以領取獎勵。`,
      };
    });
  }

  async listDiscoveries(userId: string, worldId: string): Promise<DiscoveryRecordView[]> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const records = await this.prisma.discoveryRecord.findMany({ where: { worldId } });
    return records.map((r) => {
      const def = discoveryById(r.discoveryId);
      return {
        id: r.id,
        discoveryId: r.discoveryId,
        name: def.name,
        category: def.category,
        rarity: def.rarity,
        registered: r.registered,
        goldReward: def.goldReward,
        fameReward: def.fameReward,
      };
    });
  }

  async registerDiscovery(
    userId: string,
    worldId: string,
    portId: string,
    discoveryRecordId: string,
  ): Promise<RegisterDiscoveryResult> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const port = portById(portId);
    if (port.size < BALANCE.GUILD_HALL_MIN_PORT_SIZE) throw new GameError("NO_GUILD_HALL");

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.discoveryRecord.findUnique({ where: { id: discoveryRecordId } });
      if (!record || record.worldId !== worldId) throw new GameError("NOT_FOUND");
      if (record.registered) throw new GameError("DISCOVERY_ALREADY_REGISTERED");

      const def = discoveryById(record.discoveryId);
      await tx.discoveryRecord.update({ where: { id: record.id }, data: { registered: true } });

      const guild = await tx.guild.findFirstOrThrow({ where: { worldId, kind: "PLAYER" } });
      await tx.guild.update({
        where: { id: guild.id },
        data: { gold: guild.gold + BigInt(def.goldReward), fame: { increment: def.fameReward } },
      });

      return { goldReward: def.goldReward, fameReward: def.fameReward };
    });
  }
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
