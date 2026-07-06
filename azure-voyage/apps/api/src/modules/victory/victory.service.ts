import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  BALANCE,
  regionsDominatedBy,
  shipClassById,
  victoryAssetTarget,
  type Difficulty,
  type ServerVictoryPayload,
} from "@azure-voyage/shared";
import { PrismaService } from "../../prisma/prisma.service";

export const WORLD_VICTORY_EVENT = "world.victory";

export interface WorldVictoryEventPayload {
  worldId: string;
  payload: ServerVictoryPayload;
}

/**
 * 勝利判定（docs/02 §2、docs/05 §1 PHASE 8）：每 tick 檢查玩家商會是否已達成
 * 「海域霸權」或「總資產」任一勝利條件，達成則將世界標記為 VICTORY 並廣播事件。
 * ACTIVE 以外的世界（已 VICTORY/DEFEAT/ABANDONED）不再重複判定。
 */
@Injectable()
export class VictoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async checkVictory(worldId: string, tick: number): Promise<void> {
    const world = await this.prisma.gameWorld.findUniqueOrThrow({ where: { id: worldId } });
    if (world.status !== "ACTIVE") return;

    const playerGuild = await this.prisma.guild.findFirstOrThrow({
      where: { worldId, kind: "PLAYER" },
    });

    const rows = await this.prisma.portInfluence.findMany({
      where: { portState: { worldId } },
      include: { portState: true },
    });
    const shareRows = rows.map((r) => ({
      portId: r.portState.portId,
      guildId: r.guildId,
      share: Number(r.share),
    }));
    const regionsDominated = regionsDominatedBy(playerGuild.id, shareRows);

    let reason: ServerVictoryPayload["reason"] | null = null;
    if (regionsDominated >= BALANCE.VICTORY_REGIONS_REQUIRED) {
      reason = "REGION_DOMINANCE";
    } else {
      const ships = await this.prisma.ship.findMany({
        where: { fleet: { worldId, guildId: playerGuild.id } },
      });
      const shipValue = ships.reduce((acc, s) => acc + shipClassById(s.shipClassId).price, 0);
      const totalAssets = Number(playerGuild.gold) + shipValue;
      if (totalAssets >= victoryAssetTarget(world.difficulty as Difficulty)) {
        reason = "ASSET_TARGET";
      }
    }
    if (!reason) return;

    await this.prisma.gameWorld.update({ where: { id: worldId }, data: { status: "VICTORY" } });
    const payload: ServerVictoryPayload = { status: "VICTORY", tick, reason };
    this.events.emit(WORLD_VICTORY_EVENT, { worldId, payload } satisfies WorldVictoryEventPayload);
  }
}
