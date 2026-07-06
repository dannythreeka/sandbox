import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { SetRouteInputSchema, type SetRouteInput } from "@azure-voyage/shared";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { VoyageService } from "./voyage.service";

@Controller("worlds/:worldId/fleets/:fleetId")
@UseGuards(JwtAuthGuard)
export class VoyageController {
  constructor(private readonly voyageService: VoyageService) {}

  @Post("route")
  setRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("fleetId") fleetId: string,
    @Body(new ZodPipe(SetRouteInputSchema)) input: SetRouteInput,
  ) {
    return this.voyageService.setRoute(user.userId, worldId, fleetId, input.targetPortId);
  }

  @Post("depart")
  depart(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("fleetId") fleetId: string,
  ) {
    return this.voyageService.depart(user.userId, worldId, fleetId);
  }

  @Post("anchor")
  anchor(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("fleetId") fleetId: string,
  ) {
    return this.voyageService.toggleAnchor(user.userId, worldId, fleetId);
  }
}
