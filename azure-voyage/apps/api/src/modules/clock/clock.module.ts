import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MarketModule } from "../market/market.module";
import { OfficerModule } from "../officer/officer.module";
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
  ],
  providers: [ClockService, WorldTickProcessor],
  exports: [ClockService],
})
export class ClockModule {}
