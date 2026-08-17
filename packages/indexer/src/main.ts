import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  const corsOrigin = process.env.INDEXER_CORS_ORIGIN?.trim() || "*";
  app.enableCors({
    origin:
      corsOrigin === "*"
        ? true
        : corsOrigin.split(",").map((s) => s.trim()),
    methods: ["GET", "HEAD", "OPTIONS", "POST"],
    allowedHeaders: ["content-type", "authorization"],
    exposedHeaders: ["content-type"],
    optionsSuccessStatus: 204,
  });
  const port = Number(process.env.INDEXER_PORT ?? process.env.PORT ?? 8787);
  await app.listen(port);
  console.log(`[indexer] listening on :${port}`);
}

bootstrap().catch((err) => {
  console.error("[indexer] fatal", err);
  process.exit(1);
});
