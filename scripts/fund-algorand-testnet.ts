/**
 * Fund testnet accounts via AlgoKit TestNet Dispenser API.
 * https://dev.algorand.co/concepts/accounts/funding/
 *
 * Prerequisite: pip install algokit && algokit dispenser login --ci
 * Add token to .env as ALGOKIT_DISPENSER_ACCESS_TOKEN
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import algosdk from "algosdk";
import { TestNetDispenserApiClient } from "@algorandfoundation/algokit-utils/types/dispenser-client";

const root = process.cwd();
const envPath = join(root, ".env");
const MICRO_PER_ALGO = 1_000_000;
const DEFAULT_ALGO = 10;

function loadEnvToken(): string | undefined {
  if (process.env.ALGOKIT_DISPENSER_ACCESS_TOKEN?.trim()) {
    return process.env.ALGOKIT_DISPENSER_ACCESS_TOKEN.trim();
  }
  const tokenFile = join(root, ".algokit_ci_token.txt");
  if (existsSync(tokenFile)) {
    const t = readFileSync(tokenFile, "utf8").trim();
    if (t) return t;
  }
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("ALGOKIT_DISPENSER_ACCESS_TOKEN=")) {
      return trimmed.slice("ALGOKIT_DISPENSER_ACCESS_TOKEN=".length).trim();
    }
  }
  return undefined;
}

function loadAddresses(): string[] {
  const keys = [
    "ALGORAND_OPERATOR_ADDRESS",
    "ALGORAND_SETTLER_ADDRESS",
    "ALGORAND_AGENT_ADDRESS",
    "ALGORAND_MERCHANT_ADDRESS",
  ];
  const fromEnv = keys
    .map((k) => process.env[k]?.trim())
    .filter((a): a is string => Boolean(a));
  if (fromEnv.length > 0) return fromEnv;

  if (!existsSync(envPath)) return [];
  const map = new Map<string, string>();
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return keys.map((k) => map.get(k)?.trim()).filter((a): a is string => Boolean(a));
}

async function waitForBalance(address: string, minMicro: number): Promise<void> {
  const algod = new algosdk.Algodv2(
    "",
    process.env.ALGORAND_ALGOD_URL?.trim() ??
      "https://testnet-api.algonode.cloud",
    "",
  );
  for (let i = 0; i < 30; i++) {
    const info = await algod.accountInformation(address).do();
    if (Number(info.amount) >= minMicro) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`timeout waiting for balance on ${address}`);
}

async function main(): Promise<void> {
  const token = loadEnvToken();
  if (!token) {
    console.error(
      "[fund] Missing ALGOKIT_DISPENSER_ACCESS_TOKEN.\n" +
        "  1. pip install algokit\n" +
        "  2. algokit dispenser login --ci\n" +
        "  3. Add token to .env\n" +
        "Or fund manually: https://dispenser.testnet.aws.algodev.network/",
    );
    process.exit(1);
  }

  const addresses = loadAddresses();
  if (addresses.length === 0) {
    console.error("[fund] No addresses in .env — run pnpm protocol:bootstrap-env first");
    process.exit(1);
  }

  const algoPerAccount = Number(process.env.X500_FUND_ALGO_PER_ACCOUNT ?? DEFAULT_ALGO);
  const amountMicro = algoPerAccount * MICRO_PER_ALGO;
  const client = new TestNetDispenserApiClient({ authToken: token, requestTimeout: 60 });

  const limit = await client.getLimit();
  console.log(`[fund] daily limit remaining: ${limit.amount / MICRO_PER_ALGO} ALGO`);

  for (const address of addresses) {
    const res = await client.fund(address, amountMicro);
    console.log(`[fund] ${address} tx=${res.txId} amount=${res.amount}`);
    await waitForBalance(address, amountMicro / 10);
    const algod = new algosdk.Algodv2(
      "",
      process.env.ALGORAND_ALGOD_URL?.trim() ??
        "https://testnet-api.algonode.cloud",
      "",
    );
    const info = await algod.accountInformation(address).do();
    console.log(`[fund] ${address} balance=${Number(info.amount) / MICRO_PER_ALGO} ALGO`);
  }

  console.log("[fund] done");
}

main().catch((err) => {
  console.error("[fund] failed", err);
  process.exit(1);
});
