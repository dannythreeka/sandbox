import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BALANCE, type ServerDefeatPayload } from "@azure-voyage/shared";
import { PrismaService } from "../../prisma/prisma.service";

export const WORLD_DEFEAT_EVENT = "world.defeat";

export interface WorldDefeatEventPayload {
  worldId: string;
  payload: ServerDefeatPayload;
}

/**
 * 破產判定（M31，docs/25）：docs/01 §2 原始設計的失敗條件（「破產：現金 < 0
 * 且無船可賣」「旗艦沉沒且無力再購船」）在現有規則下其實不可達——全系統的
 * 金流路徑都刻意設計成不會讓資金變負值（INSUFFICIENT_GOLD 檢查、欠薪走忠誠度
 * 懲罰而非硬扣、戰敗贖金上限抓現有資金比例……），賣船/分艦也都保底至少留一艘
 * 船（CANNOT_SELL_LAST_SHIP／CANNOT_SPLIT_ALL_SHIPS）。
 *
 * 這裡用「資金 <=0 且全部艦隊合計只剩最後一艘船」作為對應原始設計精神的可達成
 * 判定條件：持續達到寬限期（BANKRUPTCY_GRACE_TICKS）才正式判定 DEFEAT，讓玩家
 * 有機會在寬限期內翻本（賣貨、發現物、探索……）而不是無預警結束。
 */
@Injectable()
export class DefeatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async checkDefeat(worldId: string, tick: number): Promise<void> {
    const world = await this.prisma.gameWorld.findUniqueOrThrow({ where: { id: worldId } });
    if (world.status !== "ACTIVE") return;

    const guild = await this.prisma.guild.findFirstOrThrow({ where: { worldId, kind: "PLAYER" } });
    const shipCount = await this.prisma.ship.count({
      where: { fleet: { worldId, guildId: guild.id } },
    });
    const isBroke = Number(guild.gold) <= 0 && shipCount <= 1;

    if (!isBroke) {
      if (world.bankruptTicks > 0) {
        await this.prisma.gameWorld.update({ where: { id: worldId }, data: { bankruptTicks: 0 } });
      }
      return;
    }

    const bankruptTicks = world.bankruptTicks + 1;
    if (bankruptTicks < BALANCE.BANKRUPTCY_GRACE_TICKS) {
      await this.prisma.gameWorld.update({ where: { id: worldId }, data: { bankruptTicks } });
      return;
    }

    await this.prisma.gameWorld.update({ where: { id: worldId }, data: { status: "DEFEAT" } });
    const payload: ServerDefeatPayload = { status: "DEFEAT", tick, reason: "BANKRUPTCY" };
    this.events.emit(WORLD_DEFEAT_EVENT, { worldId, payload } satisfies WorldDefeatEventPayload);
  }
}
