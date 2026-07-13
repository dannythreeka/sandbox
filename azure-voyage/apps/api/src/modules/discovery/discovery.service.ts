import { Injectable } from "@nestjs/common";
import {
  axialToOddr,
  BALANCE,
  deriveSeed,
  discoveryById,
  DISCOVERIES,
  explorationSuccessChance,
  offsetDistance,
  portByIdOrFallback,
  regionForCoord,
  Rng,
  weatherAtTick,
  weatherExplorationMult,
  type DiscoveryCodexEntry,
  type DiscoveryRecordView,
  type ExploreResult,
  type RegisterDiscoveryResult,
} from "@azure-voyage/shared";
import { GameError } from "../../common/errors/game-error";
import { PrismaService } from "../../prisma/prisma.service";
import { DiscoveryNarrativeService } from "../ai/discovery-narrative.service";
import { awardCaptainExp } from "../officer/captain-growth.util";

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly narrative: DiscoveryNarrativeService,
  ) {}

  async explore(userId: string, worldId: string, fleetId: string): Promise<ExploreResult> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const result = await this.prisma.$transaction(async (tx) => {
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
        return { success: false, narrative: `這次的探索沒有斬獲，只能悻悻然返航。` } satisfies ExploreResult;
      }

      const record = await tx.discoveryRecord.create({
        data: { worldId, discoveryId: target.id, foundTick: world.currentTick },
      });
      return {
        success: true,
        discoveryId: target.id,
        name: target.name,
        narrative: `艦隊發現了「${target.name}」！記得回港口向學會登錄以領取獎勵。`,
        _recordId: record.id,
        _seed: deriveSeed(world.seed, world.currentTick, hashId(target.id), 0x9a44e),
      } satisfies ExploreResult & { _recordId: string; _seed: number };
    });

    // 圖鑑敘事（AI 生成或 fallback）不在交易內做——避免拿著 DB transaction 等網路 I/O；
    // 失敗也不影響探索本身已經成功的事實，單純留給下次讀圖鑑時該筆還沒有敘事文本。
    if (result.success && "_recordId" in result) {
      const target = discoveryById(result.discoveryId!);
      try {
        const narrativeText = await this.narrative.generate({
          worldId,
          name: target.name,
          category: target.category,
          description: target.description,
          seed: result._seed,
        });
        await this.prisma.discoveryRecord.update({
          where: { id: result._recordId },
          data: { narrative: narrativeText },
        });
      } catch {
        // 靜默略過：圖鑑敘事是加值層，不影響探索成功的主流程。
      }
      const { _recordId, _seed, ...publicResult } = result;
      return publicResult;
    }

    return result;
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
        narrative: r.narrative ?? undefined,
      };
    });
  }

  /** 圖鑑（docs/01 §4.6）：完整發現物清單，尚未找到的以剪影呈現（不洩漏名稱/獎勵）。 */
  async getCodex(userId: string, worldId: string): Promise<DiscoveryCodexEntry[]> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const records = await this.prisma.discoveryRecord.findMany({ where: { worldId } });
    const byDiscoveryId = new Map(records.map((r) => [r.discoveryId, r]));

    return DISCOVERIES.map((def) => {
      const record = byDiscoveryId.get(def.id);
      if (!record) {
        return { discoveryId: def.id, category: def.category, rarity: def.rarity, found: false, registered: false };
      }
      return {
        discoveryId: def.id,
        category: def.category,
        rarity: def.rarity,
        found: true,
        registered: record.registered,
        name: def.name,
        description: def.description,
        narrative: record.narrative ?? undefined,
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

    const port = portByIdOrFallback(portId);
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
      await awardCaptainExp(tx, guild.id, BALANCE.CAPTAIN_EXP_PER_DISCOVERY);

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
