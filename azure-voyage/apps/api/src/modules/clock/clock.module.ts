import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AiModule } from "../ai/ai.module";
import { BattleModule } from "../battle/battle.module";
import { EventModule } from "../event/event.module";
import { InfluenceModule } from "../influence/influence.module";
import { MarketModule } from "../market/market.module";
import { NpcModule } from "../npc/npc.module";
import { OfficerModule } from "../officer/officer.module";
import { VictoryModule } from "../victory/victory.module";
import { VoyageModule } from "../voyage/voyage.module";
import { WorldModule } from "../world/world.module";
import { ClockService } from "./clock.service";
import { WORLD_TICK_QUEUE, WorldTickProcessor } from "./world-tick.processor";

@Module({
  imports: [
    BullModule.registerQueue({ name: WORLD_TICK_QUEUE }),
    VoyageModule,
    WorldModule,
    MarketModule,
    OfficerModule,
    BattleModule,
    EventModule,
    InfluenceModule,
    NpcModule,
    VictoryModule,
    AiModule,
  ],
  providers: [ClockService, WorldTickProcessor],
  exports: [ClockService],
})
export class ClockModule {}
