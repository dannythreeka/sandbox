import { Inject, Injectable } from "@nestjs/common";
import { BALANCE } from "@azure-voyage/shared";
import type IORedis from "ioredis";
import { REDIS_CLIENT } from "../../redis/redis.module";

/**
 * 每世界每日 token 預算（docs/06 §7）：Redis 計數器，超額當日全走 fallback。
 */
@Injectable()
export class AiBudgetService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: IORedis) {}

  private key(worldId: string): string {
    const day = new Date().toISOString().slice(0, 10);
    return `ai:budget:${worldId}:${day}`;
  }

  /** 預估用量在配額內才准許呼叫；准許時立刻預扣，避免並發超額。 */
  async tryConsume(worldId: string, estimatedTokens: number): Promise<boolean> {
    const key = this.key(worldId);
    const used = Number((await this.redis.get(key)) ?? 0);
    if (used + estimatedTokens > BALANCE.AI_DAILY_TOKEN_BUDGET) return false;
    await this.redis.incrby(key, estimatedTokens);
    await this.redis.expire(key, 60 * 60 * 26);
    return true;
  }
}
