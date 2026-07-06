import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  AssignRoleInputSchema,
  RecruitInputSchema,
  type AssignRoleInput,
  type RecruitInput,
} from "@azure-voyage/shared";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { OfficerService } from "./officer.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class OfficerController {
  constructor(private readonly officerService: OfficerService) {}

  @Get("worlds/:worldId/ports/:portId/tavern")
  getTavern(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
  ) {
    return this.officerService.getTavern(user.userId, worldId, portId);
  }

  @Post("worlds/:worldId/ports/:portId/tavern/recruit")
  recruit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("portId") portId: string,
    @Body(new ZodPipe(RecruitInputSchema)) input: RecruitInput,
  ) {
    return this.officerService.recruit(user.userId, worldId, portId, input.fleetId, input.officerId);
  }

  @Post("worlds/:worldId/fleets/:fleetId/officers/:officerId/assign")
  assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Param("fleetId") fleetId: string,
    @Param("officerId") officerId: string,
    @Body(new ZodPipe(AssignRoleInputSchema)) input: AssignRoleInput,
  ) {
    return this.officerService.assignRole(user.userId, worldId, fleetId, officerId, input);
  }
}
