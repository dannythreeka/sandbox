import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "./jwt-payload";
import { REQUEST_USER_KEY } from "./jwt-auth.guard";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context
      .switchToHttp()
      .getRequest<{ [REQUEST_USER_KEY]?: AuthenticatedUser }>();
    const user = request[REQUEST_USER_KEY];
    if (!user) {
      // Guard 未掛就用了 decorator —— 程式錯誤，fail fast
      throw new Error("CurrentUser used without JwtAuthGuard");
    }
    return user;
  },
);
