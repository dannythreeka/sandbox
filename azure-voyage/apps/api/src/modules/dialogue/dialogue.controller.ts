import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { DialogueRequestSchema, type DialogueRequest } from "@azure-voyage/shared";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../../common/auth/jwt-payload";
import { ZodPipe } from "../../common/zod/zod.pipe";
import { DialogueService } from "../ai/dialogue.service";

@Controller("worlds/:worldId/dialogue")
@UseGuards(JwtAuthGuard)
export class DialogueController {
  constructor(private readonly dialogueService: DialogueService) {}

  @Post()
  chat(
    @CurrentUser() user: AuthenticatedUser,
    @Param("worldId") worldId: string,
    @Body(new ZodPipe(DialogueRequestSchema)) input: DialogueRequest,
  ) {
    return this.dialogueService.chat(user.userId, worldId, input.targetType, input.targetId, input.message);
  }
}
