import { Module } from "@nestjs/common";
import { AiBudgetService } from "./ai-budget.service";
import { ClaudeClientService } from "./claude-client.service";
import { EventGenService } from "./event-gen.service";
import { NpcStrategyService } from "./npc-strategy.service";
import { PersonaService } from "./persona.service";

@Module({
  providers: [ClaudeClientService, AiBudgetService, NpcStrategyService, EventGenService, PersonaService],
  exports: [NpcStrategyService, EventGenService, PersonaService],
})
export class AiModule {}
