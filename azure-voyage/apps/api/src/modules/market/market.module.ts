import { Module } from "@nestjs/common";
import { IdempotencyService } from "../../common/idempotency/idempotency.service";
import { EconomyService } from "./economy.service";
import { MarketController } from "./market.controller";
import { MarketService } from "./market.service";

@Module({
  controllers: [MarketController],
  providers: [MarketService, EconomyService, IdempotencyService],
  exports: [MarketService, EconomyService],
})
export class MarketModule {}
