import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { RegisterDiscoveryInputSchema, type RegisterDiscoveryInput } from "@azure-voyage/shared";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { DiscoveryService } from "./discovery.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post("worlds/:worldId/fleets/:fleetId/explore")
  explore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("fleetId") fleetId: string,
  ) {
    return this.discoveryService.explore(user.userId, worldId, fleetId);
  }

  @Get("worlds/:worldId/discoveries")
  list(@CurrentUser() user: AuthenticatedUser, @Param("worldId") worldId: string) {
    return this.discoveryService.listDiscoveries(user.userId, worldId);
  }

  @Get("worlds/:worldId/discoveries/codex")
  codex(@CurrentUser() user: AuthenticatedUser, @Param("worldId") worldId: string) {
    return this.discoveryService.getCodex(user.userId, worldId);
  }

  @Post("worlds/:worldId/ports/:portId/guild-hall/register-discovery")
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
    @Body(new ZodPipe(RegisterDiscoveryInputSchema)) input: RegisterDiscoveryInput,
  ) {
    return this.discoveryService.registerDiscovery(
      user.userId,
      worldId,
      portId,
      input.discoveryRecordId,
    );
  }
}
