import { Module } from "@nestjs/common";
import { OfficerController } from "./officer.controller";
import { OfficerService } from "./officer.service";

@Module({
  controllers: [OfficerController],
  providers: [OfficerService],
  exports: [OfficerService],
})
export class OfficerModule {}
