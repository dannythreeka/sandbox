import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { Socket } from "socket.io";
import { WS_EVENTS, type ApiErrorBody, type ErrorCode } from "@azure-voyage/shared";
import { GameError } from "./game-error";

function toBody(exception: unknown): { status: number; body: ApiErrorBody } {
  if (exception instanceof GameError) {
    return {
      status: exception.httpStatus,
      body: {
        ok: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      },
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code: ErrorCode =
      status === 401
        ? "UNAUTHORIZED"
        : status === 403
          ? "FORBIDDEN"
          : status === 404
            ? "NOT_FOUND"
            : status === 400
              ? "VALIDATION_FAILED"
              : "INTERNAL";
    return {
      status,
      body: { ok: false, error: { code, message: exception.message } },
    };
  }
  return {
    status: 500,
    body: { ok: false, error: { code: "INTERNAL", message: "伺服器發生未預期的錯誤" } },
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = toBody(exception);
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    if (host.getType() === "http") {
      const reply = host.switchToHttp().getResponse<FastifyReply>();
      void reply.status(status).send(body);
      return;
    }
    if (host.getType() === "ws") {
      const client = host.switchToWs().getClient<Socket>();
      client.emit(WS_EVENTS.SERVER_ERROR, body.error);

      // Socket.IO 的 ack 回呼是原始 handler 參數的最後一個（若呼叫端有帶 ack）。
      // 正常回傳路徑由 Nest 自動幫忙呼叫 ack，但例外會整個繞過那條路徑——
      // 若不在這裡手動補呼叫，呼叫端用 Promise 包 ack 的寫法會永遠掛著等不到回應
      // （曾在戰鬥面板「執行」按鈕卡死、以及 client:advance 失敗時的整合測試中實際發生過）。
      // Socket.IO 底層 handler 收到的原始參數陣列裡，ack callback 不一定在最後一格
      // （實測發現 Nest 的 ws context 會在後面再附加事件名稱字串），因此改用型別掃描
      // 找出真正的 function，而不是假設固定位置。
      const args = host.getArgs<unknown[]>();
      const maybeAck = args.find((a) => typeof a === "function");
      if (typeof maybeAck === "function") {
        (maybeAck as (response: unknown) => void)({ error: body.error });
      }
    }
  }
}
