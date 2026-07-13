import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { QUEST_CHAPTERS, shipClassById, type ServerQuestChapterPayload } from "@azure-voyage/shared";
import { PrismaService } from "../../prisma/prisma.service";

export const WORLD_QUEST_CHAPTER_EVENT = "world.quest-chapter";

export interface WorldQuestChapterEventPayload {
  worldId: string;
  payload: ServerQuestChapterPayload;
}

/**
 * 主線任務章節判定（M28，docs/22）：每 tick 檢查玩家商會是否已達成目前章節的
 * 目標，達成則發獎勵、推進章節、廣播過場事件。條件全部從既有可查詢狀態評估
 * （交易商譽、官員數、海戰勝場、影響力、總資產、勝利狀態），不需要額外的
 * 行動計數器。全部章節完成後（questChapter === QUEST_CHAPTERS.length）不再判定。
 */
@Injectable()
export class QuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async checkProgress(worldId: string, tick: number): Promise<void> {
    const world = await this.prisma.gameWorld.findUniqueOrThrow({ where: { id: worldId } });
    if (world.questChapter >= QUEST_CHAPTERS.length) return;

    const chapter = QUEST_CHAPTERS[world.questChapter];
    const guild = await this.prisma.guild.findFirstOrThrow({ where: { worldId, kind: "PLAYER" } });

    const satisfied = await this.checkChapterCondition(chapter.id, worldId, world.status, guild.id, guild.gold);
    if (!satisfied) return;

    await this.prisma.guild.update({
      where: { id: guild.id },
      data: {
        gold: guild.gold + BigInt(chapter.goldReward),
        fame: { increment: chapter.fameReward },
      },
    });
    await this.prisma.gameWorld.update({
      where: { id: worldId },
      data: { questChapter: world.questChapter + 1 },
    });

    const payload: ServerQuestChapterPayload = {
      tick,
      chapterId: chapter.id,
      title: chapter.title,
      narrative: chapter.narrative,
      goldReward: chapter.goldReward,
      fameReward: chapter.fameReward,
    };
    this.events.emit(WORLD_QUEST_CHAPTER_EVENT, { worldId, payload } satisfies WorldQuestChapterEventPayload);
  }

  private async checkChapterCondition(
    chapterId: string,
    worldId: string,
    worldStatus: string,
    playerGuildId: string,
    playerGold: bigint,
  ): Promise<boolean> {
    switch (chapterId) {
      case "ch1": {
        // 完成過交易：商譽只會因交易累積（market.service#trade），> 0 即代表交易過
        const rows = await this.prisma.portInfluence.findMany({
          where: { guildId: playerGuildId },
          select: { goodwill: true },
        });
        return rows.some((r) => Number(r.goodwill) > 0);
      }
      case "ch2": {
        const count = await this.prisma.officer.count({
          where: { worldId, fleet: { guildId: playerGuildId } },
        });
        return count >= 2;
      }
      case "ch3": {
        const fleet = await this.prisma.fleet.findFirst({ where: { worldId, guildId: playerGuildId } });
        if (!fleet) return false;
        const wins = await this.prisma.battle.count({
          where: { worldId, fleetId: fleet.id, status: "PLAYER_WIN" },
        });
        return wins >= 1;
      }
      case "ch4": {
        const rows = await this.prisma.portInfluence.findMany({
          where: { guildId: playerGuildId },
          select: { share: true },
        });
        return rows.some((r) => Number(r.share) >= 20);
      }
      case "ch5": {
        const ships = await this.prisma.ship.findMany({
          where: { fleet: { worldId, guildId: playerGuildId } },
        });
        const shipValue = ships.reduce((acc, s) => acc + shipClassById(s.shipClassId).price, 0);
        return Number(playerGold) + shipValue >= 100_000;
      }
      case "ch6":
        return worldStatus === "VICTORY";
      default:
        return false;
    }
  }
}
