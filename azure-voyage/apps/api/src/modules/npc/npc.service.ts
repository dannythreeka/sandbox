import { Injectable } from "@nestjs/common";
import { BALANCE, deriveSeed, NpcStrategySchema, PORTS, Rng, type NpcStrategy } from "@azure-voyage/shared";
import { InfluenceService } from "../influence/influence.service";
import { PrismaService } from "../../prisma/prisma.service";

interface Persona {
  archetype: string;
  riskTolerance: number;
  aggression: number;
  homeRegionId: string;
}

/**
 * NPC 商會的規則型執行器（docs/05 §6、docs/06）：原子行動固定是「投資一個
 * 港口」；M8 起，投哪個港口由 Guild.aiStrategy（AI 或 fallback 生成的目標
 * 佇列，見 NpcStrategyService）的最高優先目標決定，沒有有效策略時退回
 * M7 的「主場海域隨機挑港」邏輯——執行器介面完全不變。
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
      const port = this.pickTargetPort(guild.aiStrategy, persona, rng);
      if (!port) continue;

      const gold = Number(guild.gold);
      const amount = Math.round(gold * BALANCE.NPC_INVEST_GOLD_FRACTION * persona.riskTolerance);
      if (amount <= 0 || amount > gold) continue;

      await this.influenceService.investAsGuild(worldId, guild.id, port.id, amount);
    }
  }

  /** 優先度數字越大越急迫；同分時取第一個。 */
  private pickTargetPort(
    aiStrategy: unknown,
    persona: Persona,
    rng: Rng,
  ): { id: string } | null {
    const strategy = this.parseStrategy(aiStrategy);
    const goal = strategy?.goals.reduce((a, b) => (b.priority > a.priority ? b : a));

    if (goal) {
      const namedPorts = goal.portIds.length > 0 ? PORTS.filter((p) => goal.portIds.includes(p.id)) : [];
      const regionPorts = namedPorts.length > 0 ? namedPorts : PORTS.filter((p) => p.regionId === goal.regionId);
      if (regionPorts.length > 0) return rng.pick(regionPorts);
    }

    const homePorts = PORTS.filter((p) => p.regionId === persona.homeRegionId);
    return homePorts.length > 0 ? rng.pick(homePorts) : null;
  }

  private parseStrategy(aiStrategy: unknown): NpcStrategy | null {
    if (!aiStrategy) return null;
    const parsed = NpcStrategySchema.safeParse(aiStrategy);
    return parsed.success ? parsed.data : null;
  }
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
