import { Inject, Injectable } from "@nestjs/common";
import type IORedis from "ioredis";
import { REDIS_CLIENT } from "../../redis/redis.module";

const TTL_SECONDS = 60;

/** 冪等鍵快取（docs/04 §9）：同一 Idempotency-Key 60 秒內回放上次結果，不重複扣款。 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: IORedis) {}

  async run<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
    if (!key) return fn();
    const cacheKey = `idem:${key}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as T;

    const result = await fn();
    await this.redis.set(cacheKey, JSON.stringify(result), "EX", TTL_SECONDS);
    return result;
  }
}
