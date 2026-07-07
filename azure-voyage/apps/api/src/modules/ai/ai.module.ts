import { Module } from "@nestjs/common";
import { AiBudgetService } from "./ai-budget.service";
import { ClaudeClientService } from "./claude-client.service";
import { EventGenService } from "./event-gen.service";
import { NpcStrategyService } from "./npc-strategy.service";

@Module({
  providers: [ClaudeClientService, AiBudgetService, NpcStrategyService, EventGenService],
  exports: [NpcStrategyService, EventGenService],
})
export class AiModule {}
