import { ERROR_MESSAGES_ZH_TW, type ErrorCode } from "@azure-voyage/shared";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  WORLD_BUSY: 409,
  WORLD_LIMIT_REACHED: 409,
  WORLD_NOT_ACTIVE: 409,
  INSUFFICIENT_GOLD: 409,
  CARGO_FULL: 409,
  PORT_NOT_DOCKED: 409,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** 領域錯誤：一律用錯誤碼建構，訊息預設取自共用字典。 */
export class GameError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? ERROR_MESSAGES_ZH_TW[code]);
    this.name = "GameError";
  }

  get httpStatus(): number {
    return STATUS_BY_CODE[this.code];
  }
}
