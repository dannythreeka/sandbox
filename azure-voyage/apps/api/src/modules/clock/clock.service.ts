import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QueueEvents } from "bullmq";
import { ConfigService } from "@nestjs/config";
import type { ServerTickPayload } from "@azure-voyage/shared";
import type IORedis from "ioredis";
import { GameError } from "../../common/errors/game-error";
import { REDIS_CLIENT } from "../../redis/redis.module";
import { WorldService } from "../world/world.service";
import { WORLD_TICK_QUEUE, type AdvanceJobData } from "./world-tick.processor";

const LOCK_TTL_MS = 15_000;
const JOB_TIMEOUT_MS = 20_000;

@Injectable()
export class ClockService implements OnModuleDestroy {
  private readonly queueEvents: QueueEvents;

  constructor(
    @InjectQueue(WORLD_TICK_QUEUE) private readonly queue: Queue<AdvanceJobData>,
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly worldService: WorldService,
    config: ConfigService,
  ) {
    this.queueEvents = new QueueEvents(WORLD_TICK_QUEUE, {
      connection: { url: config.get<string>("REDIS_URL") ?? "redis://localhost:6379" },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }

  /** 推進世界 tick（docs/05 §1、docs/02 §4）：world 級鎖 + BullMQ 佇列。 */
  async requestAdvance(userId: string, worldId: string, ticks: number): Promise<ServerTickPayload> {
    const world = await this.worldService.getOwned(userId, worldId);
    if (world.status !== "ACTIVE") throw new GameError("WORLD_NOT_ACTIVE");

    const lockKey = `lock:world:${worldId}`;
    const acquired = await this.redis.set(lockKey, "1", "PX", LOCK_TTL_MS, "NX");
    if (!acquired) throw new GameError("WORLD_BUSY");

    try {
      const job = await this.queue.add(
        "advance",
        { worldId, ticks },
        { removeOnComplete: true, removeOnFail: true },
      );
      return await job.waitUntilFinished(this.queueEvents, JOB_TIMEOUT_MS);
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
