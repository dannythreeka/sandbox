import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { ServerTickPayload } from "@azure-voyage/shared";
import { EconomyService } from "../market/economy.service";
import { OfficerService } from "../officer/officer.service";
import { VoyageService } from "../voyage/voyage.service";

export const WORLD_TICK_QUEUE = "world-tick";

export interface AdvanceJobData {
  worldId: string;
  ticks: number;
}

/**
 * 消費 tick 推進任務（docs/05 §1）。目前涵蓋 PHASE 2/3（航行/補給）、
 * PHASE 6（經濟）與航海士薪資結算；事件/NPC/影響力結算/勝敗檢查留給後續里程碑。
 */
@Processor(WORLD_TICK_QUEUE, { concurrency: 5 })
export class WorldTickProcessor extends WorkerHost {
  constructor(
    private readonly voyageService: VoyageService,
    private readonly economyService: EconomyService,
    private readonly officerService: OfficerService,
  ) {
    super();
  }

  async process(job: Job<AdvanceJobData>): Promise<ServerTickPayload> {
    const { worldId, ticks } = job.data;
    let last: ServerTickPayload | undefined;
    for (let i = 0; i < ticks; i++) {
      last = await this.voyageService.advanceOneTick(worldId);
      await this.economyService.regenAllPorts(worldId, last.tick);
      await this.officerService.paySalariesIfDue(worldId, last.tick);
    }
    return last!;
  }
}
