import { Module } from "@nestjs/common";
import { WorldModule } from "../modules/world/world.module";
import { GameGateway } from "./game.gateway";

@Module({
  imports: [WorldModule],
  providers: [GameGateway],
})
export class GatewayModule {}
