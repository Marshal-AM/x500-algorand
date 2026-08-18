/**
 * Write example/agent/.env and example/server/.env from root .env
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env");

function parseEnv(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

if (!existsSync(envPath)) {
  console.error("[sync-example-env] missing .env");
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));

const serverPort = env.get("SERVER_PORT")?.trim() || "8800";
const merchantOrigin =
  env.get("X500_MERCHANT_ORIGIN")?.trim() ||
  `http://127.0.0.1:${serverPort}`;

const agentEnv = [
  "# synced from root .env",
  `X500_AGENT_ADDRESS=${env.get("ALGORAND_AGENT_ADDRESS") ?? ""}`,
  `ALGORAND_AGENT_MNEMONIC=${env.get("ALGORAND_AGENT_MNEMONIC") ?? ""}`,
  "MARKET_PROXY_URL=http://127.0.0.1:8788",
  "INDEXER_URL=http://127.0.0.1:8787",
  `FACILITATOR_URL=${env.get("FACILITATOR_URL") ?? "https://facilitator.goplausible.xyz"}`,
  "X500_DEPLOYMENTS_PATH=../../config/deployments.algorand.testnet.json",
  `X500_POOL_APP_ID=${env.get("X500_POOL_APP_ID") ?? ""}`,
  `X500_MERCHANT_ORIGIN=${merchantOrigin}`,
  `GROQ_API_KEY=${env.get("GROQ_API_KEY") ?? ""}`,
  "",
].join("\n");

const serverEnv = [
  "# synced from root .env",
  `SERVER_PORT=${serverPort}`,
  "EXAMPLE_LOCAL=1",
  `NGROK_AUTHTOKEN=${env.get("NGROK_AUTHTOKEN") ?? ""}`,
  `ALGORAND_NETWORK=${env.get("ALGORAND_NETWORK") ?? "algorand:testnet"}`,
  `ALGORAND_MERCHANT_ADDRESS=${env.get("ALGORAND_MERCHANT_ADDRESS") ?? ""}`,
  `FACILITATOR_URL=${env.get("FACILITATOR_URL") ?? "https://facilitator.goplausible.xyz"}`,
  `USDC_TESTNET_ASA_ID=${env.get("USDC_TESTNET_ASA_ID") ?? "10458941"}`,
  "",
].join("\n");

writeFileSync(join(root, "example/agent/.env"), agentEnv, "utf8");
writeFileSync(join(root, "example/server/.env"), serverEnv, "utf8");
console.log("[sync-example-env] wrote example/agent/.env and example/server/.env");
