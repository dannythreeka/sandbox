import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CreateWorldInputSchema, type CreateWorldInput } from "@azure-voyage/shared";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { WorldService } from "./world.service";

@Controller("worlds")
@UseGuards(JwtAuthGuard)
export class WorldController {
  constructor(private readonly worldService: WorldService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.worldService.list(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(CreateWorldInputSchema)) input: CreateWorldInput,
  ) {
    return this.worldService.create(user.userId, input);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.worldService.getSnapshot(user.userId, id);
  }

  @Delete(":id")
  abandon(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.worldService.abandon(user.userId, id);
  }
}
