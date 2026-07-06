import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { JwtModule } from "@nestjs/jwt";
import { AllExceptionsFilter } from "./common/errors/all-exceptions.filter";
import { ResponseInterceptor } from "./common/response/response.interceptor";
import { ClockModule } from "./modules/clock/clock.module";
import { GatewayModule } from "./gateway/gateway.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BattleModule } from "./modules/battle/battle.module";
import { MarketModule } from "./modules/market/market.module";
import { OfficerModule } from "./modules/officer/officer.module";
import { ShipyardModule } from "./modules/shipyard/shipyard.module";
import { VoyageModule } from "./modules/voyage/voyage.module";
import { WorldModule } from "./modules/world/world.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 開發時共用 monorepo 根目錄的 .env
      envFilePath: ["../../.env", ".env"],
    }),
    EventEmitterModule.forRoot(),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        if (!secret) {
          throw new Error("JWT_SECRET is required (see .env.example)");
        }
        return { secret };
      },
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    WorldModule,
    VoyageModule,
    MarketModule,
    OfficerModule,
    ShipyardModule,
    BattleModule,
    ClockModule,
    GatewayModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
