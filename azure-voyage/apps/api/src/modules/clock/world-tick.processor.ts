import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { ServerTickPayload } from "@azure-voyage/shared";
import { VoyageService } from "../voyage/voyage.service";

export const WORLD_TICK_QUEUE = "world-tick";

export interface AdvanceJobData {
  worldId: string;
  ticks: number;
}

/**
 * 消費 tick 推進任務（docs/05 §1）。M2 子集：只跑航行/補給階段（VoyageService.advanceOneTick）；
 * 經濟/影響力/事件/NPC/勝敗檢查等階段將在後續里程碑加入同一迴圈。
 */
@Processor(WORLD_TICK_QUEUE, { concurrency: 5 })
export class WorldTickProcessor extends WorkerHost {
  constructor(private readonly voyageService: VoyageService) {
    super();
  }

  async process(job: Job<AdvanceJobData>): Promise<ServerTickPayload> {
    const { worldId, ticks } = job.data;
    let last: ServerTickPayload | undefined;
    for (let i = 0; i < ticks; i++) {
      last = await this.voyageService.advanceOneTick(worldId);
    }
    return last!;
  }
}
