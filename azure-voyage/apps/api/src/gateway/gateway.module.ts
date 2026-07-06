import { Module } from "@nestjs/common";
import { ClockModule } from "../modules/clock/clock.module";
import { WorldModule } from "../modules/world/world.module";
import { GameGateway } from "./game.gateway";

@Module({
  imports: [WorldModule, ClockModule],
  providers: [GameGateway],
})
export class GatewayModule {}
