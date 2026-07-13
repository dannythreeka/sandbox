import { Module } from "@nestjs/common";
import { DefeatService } from "./defeat.service";

@Module({
  providers: [DefeatService],
  exports: [DefeatService],
})
export class DefeatModule {}
