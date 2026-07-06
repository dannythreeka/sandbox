import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { BattleService } from "./battle.service";

@Controller("worlds/:worldId/battles/:battleId")
@UseGuards(JwtAuthGuard)
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("battleId") battleId: string,
  ) {
    return this.battleService.getBattle(user.userId, worldId, battleId);
  }
}
