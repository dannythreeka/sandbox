import { Module } from "@nestjs/common";
import { BattleModule } from "../modules/battle/battle.module";
import { ClockModule } from "../modules/clock/clock.module";
import { WorldModule } from "../modules/world/world.module";
import { GameGateway } from "./game.gateway";

@Module({
  imports: [WorldModule, ClockModule, BattleModule],
  providers: [GameGateway],
})
export class GatewayModule {}
