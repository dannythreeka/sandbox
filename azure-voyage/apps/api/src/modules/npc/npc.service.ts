import { Injectable } from "@nestjs/common";
import { BALANCE, deriveSeed, PORTS, Rng } from "@azure-voyage/shared";
import { InfluenceService } from "../influence/influence.service";
import { PrismaService } from "../../prisma/prisma.service";

interface Persona {
  archetype: string;
  riskTolerance: number;
  aggression: number;
  homeRegionId: string;
}

/**
 * NPC 商會的規則型執行器（docs/05 §6）：M7 範圍只做「投資home海域港口」這個
 * 原子行動；AI 生成的高階策略（目標佇列）留給 M8 接手，執行器介面不需要改變。
 */
@Injectable()
export class NpcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly influenceService: InfluenceService,
  ) {}

  async actAll(worldId: string, tick: number): Promise<void> {
    if (tick % BALANCE.NPC_ACT_INTERVAL_TICKS !== 0) return;
    const world = await this.prisma.gameWorld.findUniqueOrThrow({ where: { id: worldId } });

    const npcGuilds = await this.prisma.guild.findMany({ where: { worldId, kind: "NPC" } });
    for (const guild of npcGuilds) {
      const persona = guild.aiPersona as unknown as Persona | null;
      if (!persona) continue;

      const rng = new Rng(deriveSeed(world.seed, tick, hashId(guild.id)));
      const homePorts = PORTS.filter((p) => p.regionId === persona.homeRegionId);
      if (homePorts.length === 0) continue;
      const port = rng.pick(homePorts);

      const gold = Number(guild.gold);
      const amount = Math.round(gold * BALANCE.NPC_INVEST_GOLD_FRACTION * persona.riskTolerance);
      if (amount <= 0 || amount > gold) continue;

      await this.influenceService.investAsGuild(worldId, guild.id, port.id, amount);
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
