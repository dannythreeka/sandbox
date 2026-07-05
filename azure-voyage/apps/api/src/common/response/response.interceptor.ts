import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { map, Observable } from "rxjs";
import type { ApiOkBody } from "@azure-voyage/shared";

/** 將 HTTP controller 回傳值統一包成 { ok: true, data }（docs/02 §5）。 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiOkBody<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiOkBody<T> | T> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    return next.handle().pipe(map((data) => ({ ok: true as const, data })));
  }
}
