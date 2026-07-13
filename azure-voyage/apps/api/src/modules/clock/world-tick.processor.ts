import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { ServerTickPayload } from "@azure-voyage/shared";
import { EventGenService } from "../ai/event-gen.service";
import { NpcStrategyService } from "../ai/npc-strategy.service";
import { PersonaService } from "../ai/persona.service";
import { EncounterService } from "../battle/encounter.service";
import { EventService } from "../event/event.service";
import { InfluenceService } from "../influence/influence.service";
import { EconomyService } from "../market/economy.service";
import { NpcService } from "../npc/npc.service";
import { OfficerService } from "../officer/officer.service";
import { QuestService } from "../quest/quest.service";
import { VictoryService } from "../victory/victory.service";
import { VoyageService } from "../voyage/voyage.service";

export const WORLD_TICK_QUEUE = "world-tick";

export interface AdvanceJobData {
  worldId: string;
  ticks: number;
}

/**
 * 消費 tick 推進任務（docs/05 §1）。涵蓋 PHASE 2/3（航行/補給）、PHASE 4（海賊/風暴遭遇）、
 * PHASE 6（經濟）、規則事件（慶典排程/到期）、航海士薪資結算、PHASE 7（NPC 商會行動與
 * 影響力結算）、PHASE 8（勝利判定）與 M8 AI 層（NPC 策略刷新、傳聞事件、M19 人設補全）。
 */
@Processor(WORLD_TICK_QUEUE, { concurrency: 5 })
export class WorldTickProcessor extends WorkerHost {
  constructor(
    private readonly voyageService: VoyageService,
    private readonly economyService: EconomyService,
    private readonly officerService: OfficerService,
    private readonly encounterService: EncounterService,
    private readonly eventService: EventService,
    private readonly npcService: NpcService,
    private readonly influenceService: InfluenceService,
    private readonly victoryService: VictoryService,
    private readonly questService: QuestService,
    private readonly npcStrategyService: NpcStrategyService,
    private readonly eventGenService: EventGenService,
    private readonly personaService: PersonaService,
  ) {
    super();
  }

  async process(job: Job<AdvanceJobData>): Promise<ServerTickPayload> {
    const { worldId, ticks } = job.data;
    let last: ServerTickPayload | undefined;
    for (let i = 0; i < ticks; i++) {
      last = await this.voyageService.advanceOneTick(worldId);
      await this.encounterService.rollEncounters(worldId, last.tick);
      await this.eventService.rollStorms(worldId, last.tick);
      await this.eventService.rollFestivals(worldId, last.tick);
      await this.eventService.expireFestivals(worldId, last.tick);
      await this.eventGenService.maybeGenerateRumor(worldId, last.tick);
      await this.personaService.refreshDuePersonas(worldId);
      await this.economyService.regenAllPorts(worldId, last.tick);
      await this.officerService.paySalariesIfDue(worldId, last.tick);
      await this.npcStrategyService.refreshDueStrategies(worldId, last.tick);
      await this.npcService.actAll(worldId, last.tick);
      await this.influenceService.settleAllPorts(worldId);
      await this.victoryService.checkVictory(worldId, last.tick);
      await this.questService.checkProgress(worldId, last.tick);
    }
    return last!;
  }
}
