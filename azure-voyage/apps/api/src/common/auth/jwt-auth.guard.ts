import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import { GameError } from "../errors/game-error";
import type { AuthenticatedUser, JwtPayload } from "./jwt-payload";

/** 掛在 request 上的欄位名 */
export const REQUEST_USER_KEY = "user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { [REQUEST_USER_KEY]?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new GameError("UNAUTHORIZED");
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(header.slice(7));
      if (payload.type !== "access") {
        throw new Error("not an access token");
      }
      request[REQUEST_USER_KEY] = { userId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new GameError("UNAUTHORIZED");
    }
  }
}
