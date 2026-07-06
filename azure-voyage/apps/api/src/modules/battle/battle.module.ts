import { Module } from "@nestjs/common";
import { BattleController } from "./battle.controller";
import { BattleService } from "./battle.service";
import { EncounterService } from "./encounter.service";

@Module({
  controllers: [BattleController],
  providers: [BattleService, EncounterService],
  exports: [BattleService, EncounterService],
})
export class BattleModule {}
