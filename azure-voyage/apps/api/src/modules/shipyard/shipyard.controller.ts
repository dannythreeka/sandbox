import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import {
  BuildShipInputSchema,
  RepairInputSchema,
  SellShipInputSchema,
  type BuildShipInput,
  type RepairInput,
  type SellShipInput,
} from "@azure-voyage/shared";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { ShipyardService } from "./shipyard.service";

@Controller("worlds/:worldId/ports/:portId/shipyard")
@UseGuards(JwtAuthGuard)
export class ShipyardController {
  constructor(private readonly shipyardService: ShipyardService) {}

  @Post("build")
  build(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
    @Body(new ZodPipe(BuildShipInputSchema)) input: BuildShipInput,
  ) {
    return this.shipyardService.build(user.userId, worldId, portId, input);
  }

  @Post("repair")
  repair(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
    @Body(new ZodPipe(RepairInputSchema)) input: RepairInput,
  ) {
    return this.shipyardService.repair(user.userId, worldId, portId, input);
  }

  @Post("sell")
  sell(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
    @Body(new ZodPipe(SellShipInputSchema)) input: SellShipInput,
  ) {
    return this.shipyardService.sell(user.userId, worldId, portId, input);
  }
}
