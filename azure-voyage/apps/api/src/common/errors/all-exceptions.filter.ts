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
    }
  }
}
