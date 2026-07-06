import { Module } from "@nestjs/common";
import { InfluenceModule } from "../influence/influence.module";
import { NpcService } from "./npc.service";

@Module({
  imports: [InfluenceModule],
  providers: [NpcService],
  exports: [NpcService],
})
export class NpcModule {}
