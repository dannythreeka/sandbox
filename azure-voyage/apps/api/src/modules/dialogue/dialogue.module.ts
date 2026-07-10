import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { DialogueController } from "./dialogue.controller";

@Module({
  imports: [AiModule],
  controllers: [DialogueController],
})
export class DialogueModule {}
