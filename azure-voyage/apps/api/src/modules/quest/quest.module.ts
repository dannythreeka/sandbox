import { Module } from "@nestjs/common";
import { QuestService } from "./quest.service";

@Module({
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
