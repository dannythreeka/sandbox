import { Module } from "@nestjs/common";
import { AiBudgetService } from "./ai-budget.service";
import { ClaudeClientService } from "./claude-client.service";
import { DialogueService } from "./dialogue.service";
import { DiscoveryNarrativeService } from "./discovery-narrative.service";
import { EventGenService } from "./event-gen.service";
import { NpcStrategyService } from "./npc-strategy.service";
import { PersonaService } from "./persona.service";

@Module({
  providers: [
    ClaudeClientService,
    AiBudgetService,
    NpcStrategyService,
    EventGenService,
    PersonaService,
    DialogueService,
    DiscoveryNarrativeService,
  ],
  exports: [NpcStrategyService, EventGenService, PersonaService, DialogueService, DiscoveryNarrativeService],
})
export class AiModule {}
