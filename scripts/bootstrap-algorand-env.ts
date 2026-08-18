/**
 * Generate testnet Algorand accounts, request faucet ALGO, write root .env.
 * Preserves existing NPM_TOKEN and other vars when present.
 *
 * Usage:
 *   pnpm protocol:bootstrap-env              — new accounts + fund
 *   pnpm protocol:bootstrap-env --fund-only  — fund addresses already in .env
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import algosdk from "algosdk";

const root = process.cwd();
const envPath = join(root, ".env");
const fundOnly = process.argv.includes("--fund-only");

const ALGODEV_DISPENSER =
  process.env.ALGORAND_FAUCET_URL?.trim() ??
  "https://dispenser.testnet.aws.algodev.network/transfer";
const ALGOKIT_DISPENSER =
  process.env.ALGORAND_ALGOKIT_DISPENSER_URL?.trim() ??
  "https://api.dispenser.algorandfoundation.tools/fund/0";

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

function serializeEnv(map: Map<string, string>): string {
  const keys = [
    "NPM_TOKEN",
    "ALGOKIT_DISPENSER_ACCESS_TOKEN",
    "ALGORAND_NETWORK",
    "ALGORAND_INDEXER_URL",
    "ALGORAND_ALGOD_URL",
    "FACILITATOR_URL",
    "USDC_TESTNET_ASA_ID",
    "ALGORAND_OPERATOR_ADDRESS",
    "ALGORAND_SETTLER_ADDRESS",
    "ALGORAND_AGENT_ADDRESS",
    "ALGORAND_MERCHANT_ADDRESS",
    "ALGORAND_OPERATOR_MNEMONIC",
    "ALGORAND_SETTLER_MNEMONIC",
    "ALGORAND_AGENT_MNEMONIC",
    "X500_DEPLOYMENTS_PATH",
    "X500_POOL_APP_ID",
    "INDEXER_PUSH_SECRET",
  ];
  const lines: string[] = [];
  for (const key of keys) {
    const v = map.get(key);
    if (v !== undefined) lines.push(`${key}=${v}`);
  }
  for (const [k, v] of map) {
    if (!keys.includes(k)) lines.push(`${k}=${v}`);
  }
  return `${lines.join("\n")}\n`;
}

async function faucetAlgodev(address: string, amountMicro: number): Promise<boolean> {
  const res = await fetch(ALGODEV_DISPENSER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, amount: amountMicro }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(
      `[bootstrap] algodev faucet failed ${res.status}: ${body.slice(0, 120)}`,
    );
    return false;
  }
  return true;
}

async function faucetAlgokit(
  address: string,
  amountMicro: number,
  token: string,
): Promise<boolean> {
  const res = await fetch(ALGOKIT_DISPENSER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ receiver: address, amount: amountMicro }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(
      `[bootstrap] algokit faucet failed ${res.status}: ${body.slice(0, 120)}`,
    );
    return false;
  }
  const json = (await res.json()) as { txID?: string; tx_id?: string };
  console.log(
    `[bootstrap] algokit faucet ok tx=${json.txID ?? json.tx_id ?? "?"}`,
  );
  return true;
}

async function faucet(address: string, amountMicro = 10_000_000_000): Promise<void> {
  const token =
    process.env.ALGOKIT_DISPENSER_ACCESS_TOKEN?.trim() ??
    parseEnv(existsSync(envPath) ? readFileSync(envPath, "utf8") : "").get(
      "ALGOKIT_DISPENSER_ACCESS_TOKEN",
    );

  if (token) {
    const ok = await faucetAlgokit(address, amountMicro, token);
    if (ok) return;
  }

  const ok = await faucetAlgodev(address, amountMicro);
  if (!ok) {
    throw new Error(
      `Could not fund ${address}. Add ALGOKIT_DISPENSER_ACCESS_TOKEN to .env (run: algokit dispenser login --ci) or fund manually at https://bank.testnet.algonode.cloud/`,
    );
  }
}

async function waitForBalance(
  address: string,
  minMicro = 1_000_000,
): Promise<void> {
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

async function fundAddresses(addresses: string[]): Promise<void> {
  for (const addr of addresses) {
    await faucet(addr);
    await waitForBalance(addr);
    console.log(`[bootstrap] funded ${addr}`);
  }
}

async function main(): Promise<void> {
  const existing = existsSync(envPath)
    ? parseEnv(readFileSync(envPath, "utf8"))
    : new Map<string, string>();

  if (fundOnly) {
    const addresses = [
      existing.get("ALGORAND_OPERATOR_ADDRESS"),
      existing.get("ALGORAND_SETTLER_ADDRESS"),
      existing.get("ALGORAND_AGENT_ADDRESS"),
      existing.get("ALGORAND_MERCHANT_ADDRESS"),
    ].filter((a): a is string => Boolean(a?.trim()));
    if (addresses.length === 0) {
      throw new Error("--fund-only requires addresses in .env");
    }
    await fundAddresses(addresses);
    console.log("[bootstrap] fund-only complete");
    return;
  }

  const operator = algosdk.generateAccount();
  const settler = algosdk.generateAccount();
  const agent = algosdk.generateAccount();
  const merchant = algosdk.generateAccount();

  const accounts = [
    { role: "operator", account: operator },
    { role: "settler", account: settler },
    { role: "agent", account: agent },
    { role: "merchant", account: merchant },
  ];

  await fundAddresses(accounts.map(({ account }) => account.addr.toString()));

  existing.set("ALGORAND_NETWORK", "algorand:testnet");
  existing.set(
    "ALGORAND_INDEXER_URL",
    existing.get("ALGORAND_INDEXER_URL") ??
      "https://testnet-idx.algonode.cloud",
  );
  existing.set(
    "ALGORAND_ALGOD_URL",
    existing.get("ALGORAND_ALGOD_URL") ?? "https://testnet-api.algonode.cloud",
  );
  existing.set(
    "FACILITATOR_URL",
    existing.get("FACILITATOR_URL") ??
      "https://facilitator.goplausible.xyz",
  );
  existing.set("USDC_TESTNET_ASA_ID", "10458941");
  existing.set("ALGORAND_OPERATOR_ADDRESS", operator.addr.toString());
  existing.set("ALGORAND_SETTLER_ADDRESS", settler.addr.toString());
  existing.set("ALGORAND_AGENT_ADDRESS", agent.addr.toString());
  existing.set("ALGORAND_MERCHANT_ADDRESS", merchant.addr.toString());
  existing.set(
    "ALGORAND_OPERATOR_MNEMONIC",
    algosdk.secretKeyToMnemonic(operator.sk),
  );
  existing.set(
    "ALGORAND_SETTLER_MNEMONIC",
    algosdk.secretKeyToMnemonic(settler.sk),
  );
  existing.set(
    "ALGORAND_AGENT_MNEMONIC",
    algosdk.secretKeyToMnemonic(agent.sk),
  );
  existing.set(
    "X500_DEPLOYMENTS_PATH",
    "./config/deployments.algorand.testnet.json",
  );
  if (!existing.get("INDEXER_PUSH_SECRET")) {
    existing.set(
      "INDEXER_PUSH_SECRET",
      Buffer.from(randomBytes(24)).toString("hex"),
    );
  }

  writeFileSync(envPath, serializeEnv(existing), "utf8");
  console.log("[bootstrap] wrote", envPath);
  console.log("[bootstrap] operator", operator.addr.toString());
  console.log("[bootstrap] settler", settler.addr.toString());
  console.log("[bootstrap] agent", agent.addr.toString());
  console.log("[bootstrap] merchant", merchant.addr.toString());
}

main().catch((err) => {
  console.error("[bootstrap] failed", err);
  process.exit(1);
});
