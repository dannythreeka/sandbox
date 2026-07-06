import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { InvestInputSchema, type InvestInput } from "@azure-voyage/shared";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { InfluenceService } from "./influence.service";

@Controller("worlds/:worldId/ports/:portId/invest")
@UseGuards(JwtAuthGuard)
export class InfluenceController {
  constructor(private readonly influenceService: InfluenceService) {}

  @Post()
  invest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
    @Body(new ZodPipe(InvestInputSchema)) input: InvestInput,
  ) {
    return this.influenceService.invest(user.userId, worldId, portId, input.amount);
  }
}
