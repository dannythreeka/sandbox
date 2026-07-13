import { Injectable } from "@nestjs/common";
import { investmentGain, portByIdOrFallback, settleInfluence, type InfluenceEntry } from "@azure-voyage/shared";
import { GameError } from "../../common/errors/game-error";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InfluenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** 每 tick 為所有港口跑一次影響力結算（docs/05 §1 PHASE 7）。 */
  async settleAllPorts(worldId: string): Promise<void> {
    const portStates = await this.prisma.portState.findMany({
      where: { worldId },
      include: { influences: { include: { guild: true } } },
    });

    for (const portState of portStates) {
      if (portState.influences.length === 0) continue;
      const entries: InfluenceEntry[] = portState.influences.map((i) => ({
        guildId: i.guildId,
        isLocal: i.guild.kind === "LOCAL",
        share: Number(i.share),
        goodwill: Number(i.goodwill),
      }));
      const settled = settleInfluence(entries);

      await this.prisma.$transaction(
        settled.map((s) =>
          this.prisma.portInfluence.update({
            where: { portStateId_guildId: { portStateId: portState.id, guildId: s.guildId } },
            data: { share: s.share, goodwill: s.goodwill },
          }),
        ),
      );
    }
  }

  /** 玩家港口投資：立即提升影響力份額，成本隨現有份額遞增（docs/01 §4.3）。 */
  async invest(userId: string, worldId: string, portId: string, amount: number): Promise<{ gain: number }> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");
    portByIdOrFallback(portId); // 驗證 portId 存在；若是 M21 刪除的舊港口 id 則靜默視為有效（自我修復由 world.service 負責）

    const guild = await this.prisma.guild.findFirstOrThrow({ where: { worldId, kind: "PLAYER" } });
    if (Number(guild.gold) < amount) throw new GameError("INSUFFICIENT_GOLD");
    return this.investAsGuild(worldId, guild.id, portId, amount);
  }

  /**
   * 以任意商會身分投資（docs/05 §6）：玩家與 NPC 商會共用同一套規則——
   * 誰都要有錢才能投資，誰都吃同一套 investmentGain 公式，不搞兩套邏輯。
   * 資金不足時靜默略過（NPC 呼叫方已先篩過額度，屬正常路徑而非錯誤）。
   */
  async investAsGuild(
    worldId: string,
    guildId: string,
    portId: string,
    amount: number,
  ): Promise<{ gain: number }> {
    return this.prisma.$transaction(async (tx) => {
      const guild = await tx.guild.findUniqueOrThrow({ where: { id: guildId } });
      const gold = Number(guild.gold);
      if (gold < amount) return { gain: 0 };

      const portState = await tx.portState.findUniqueOrThrow({
        where: { worldId_portId: { worldId, portId } },
      });
      const existing = await tx.portInfluence.findUnique({
        where: { portStateId_guildId: { portStateId: portState.id, guildId } },
      });
      const currentShare = existing ? Number(existing.share) : 0;
      const gain = investmentGain(amount, currentShare);

      await tx.guild.update({ where: { id: guildId }, data: { gold: BigInt(gold - amount) } });
      await tx.portInfluence.upsert({
        where: { portStateId_guildId: { portStateId: portState.id, guildId } },
        create: { portStateId: portState.id, guildId, share: gain, goodwill: 0 },
        update: { share: currentShare + gain },
      });

      return { gain };
    });
  }
}
