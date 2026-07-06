import { Module } from "@nestjs/common";
import { ShipyardController } from "./shipyard.controller";
import { ShipyardService } from "./shipyard.service";

@Module({
  controllers: [ShipyardController],
  providers: [ShipyardService],
})
export class ShipyardModule {}
