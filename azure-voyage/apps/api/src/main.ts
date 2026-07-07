import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    // 開發預設全開；正式環境設 WEB_ORIGIN。空字串（如未設定時被解析成 ""）
    // 視同未設定，否則 CORS 會把所有來源都擋下。
    origin: process.env.WEB_ORIGIN || true,
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`[azure-voyage/api] listening on :${port}`);
}

void bootstrap();
