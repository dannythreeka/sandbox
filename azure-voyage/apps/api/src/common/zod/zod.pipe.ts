import { Injectable, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
import { GameError } from "../errors/game-error";

/**
 * 用法：@Body(new ZodPipe(CreateWorldInputSchema)) input: CreateWorldInput
 * 所有 DTO 驗證一律用 shared 的 zod schema（docs/02 §6）。
 */
@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new GameError("VALIDATION_FAILED", undefined, result.error.flatten());
    }
    return result.data;
  }
}
