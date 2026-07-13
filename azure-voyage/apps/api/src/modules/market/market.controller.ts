import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { TradeInputSchema, type TradeInput } from "@azure-voyage/shared";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { IdempotencyService } from "../../common/idempotency/idempotency.service";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { MarketService } from "./market.service";

@Controller("worlds/:worldId/ports/:portId")
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  getPort(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
  ) {
    return this.marketService.getPortDetail(user.userId, worldId, portId);
  }

  @Get("trade-routes")
  getTradeRoutes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
  ) {
    return this.marketService.getTradeRouteSuggestions(user.userId, worldId, portId);
  }

  @Post("trade")
  trade(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
    @Body(new ZodPipe(TradeInputSchema)) input: TradeInput,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.idempotency.run(idempotencyKey, () =>
      this.marketService.trade(user.userId, worldId, portId, input),
    );
  }
}
