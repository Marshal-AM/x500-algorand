import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

function assertBootEnv(): void {
  if (process.env.ALGORAND_NETWORK?.trim() !== "algorand:testnet") {
    throw new Error(
      `Settler refuses boot: ALGORAND_NETWORK must be algorand:testnet`,
    );
  }
  for (const k of [
    "ALGORAND_SUPABASE_URL",
    "ALGORAND_SUPABASE_SERVICE_ROLE_KEY",
    "INDEXER_URL",
    "INDEXER_PUSH_SECRET",
    "ALGORAND_SETTLER_MNEMONIC",
  ] as const) {
    if (!process.env[k]?.trim()) {
      throw new Error(`Settler refuses boot: missing ${k}`);
    }
  }
}

async function bootstrap(): Promise<void> {
  assertBootEnv();
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const port = Number(process.env.SETTLER_PORT ?? process.env.PORT ?? 8789);
  await app.listen(port);
  console.log(`[settler] listening on :${port}`);
}

bootstrap().catch((err) => {
  console.error("[settler] fatal", err);
  process.exit(1);
});
