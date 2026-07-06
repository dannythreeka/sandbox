import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { VoyageModule } from "../voyage/voyage.module";
import { WorldModule } from "../world/world.module";
import { ClockService } from "./clock.service";
import { WORLD_TICK_QUEUE, WorldTickProcessor } from "./world-tick.processor";

@Module({
  imports: [BullModule.registerQueue({ name: WORLD_TICK_QUEUE }), VoyageModule, WorldModule],
  providers: [ClockService, WorldTickProcessor],
  exports: [ClockService],
})
export class ClockModule {}
