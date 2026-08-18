/**
 * Prepare example/agent and example/server for local E2E testing.
 * - Sync example .env files from root .env
 * - Upsert merchant endpoint for the example server origin
 * - Optionally deposit agent escrow (X500_EXAMPLE_SETUP_ESCROW=1)
 */
import { execSync } from "node:child_process";
import algosdk from "algosdk";
import { indexerUsdcBalanceMicro } from "x500-protocol-algorand-v1-client";
import { createX500 } from "../packages/x500-sdk-algorand/src/createX500.ts";
import { normalizeOriginUrl } from "./lib/normalize-origin.js";

const USDC_TESTNET_ASA_ID = 10458941;

async function ensureAgentUsdcOptIn(
  address: string,
  mnemonic: string,
): Promise<void> {
  const balance = await indexerUsdcBalanceMicro(address);
  if (balance > 0n) return;

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const algod = new algosdk.Algodv2(
    "",
    process.env.ALGORAND_ALGOD_URL?.trim() ??
      "https://testnet-api.algonode.cloud",
    "",
  );
  const info = await algod.accountInformation(address).do();
  const optedIn = info.assets?.some(
    (a) => Number(a["asset-id"]) === USDC_TESTNET_ASA_ID,
  );
  if (optedIn) return;

  console.log("[example:setup] opting agent into USDC ASA…");
  const suggestedParams = await algod.getTransactionParams().do();
  const optTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    assetIndex: USDC_TESTNET_ASA_ID,
    amount: 0,
    suggestedParams,
  });
  const signed = optTxn.signTxn(account.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
  console.log(`[example:setup] USDC opt-in tx ${txid}`);
}

async function main(): Promise<void> {
  const root = process.cwd();
  console.log("[example:setup] syncing example .env files…");
  execSync("tsx --env-file=.env scripts/sync-example-env.ts", {
    cwd: root,
    stdio: "inherit",
  });

  const port = process.env.SERVER_PORT?.trim() || "8800";
  const origin = normalizeOriginUrl(
    process.env.X500_MERCHANT_ORIGIN?.trim() ||
      process.env.EXAMPLE_PUBLIC_ORIGIN?.trim() ||
      `http://127.0.0.1:${port}`,
  );

  console.log(`[example:setup] upserting endpoint hostname=${origin}`);
  execSync(
    `tsx --env-file=.env scripts/upsert-endpoint-db.ts`,
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        X500_REGISTER_SLUG:
          process.env.X500_REGISTER_SLUG?.trim() || "pay-default",
        X500_REGISTER_HOSTNAME: origin,
      },
    },
  );

  if (process.env.X500_EXAMPLE_SETUP_ESCROW === "1") {
    const address = process.env.ALGORAND_AGENT_ADDRESS?.trim();
    const mnemonic = process.env.ALGORAND_AGENT_MNEMONIC?.trim();
    if (!address || !mnemonic) {
      throw new Error(
        "X500_EXAMPLE_SETUP_ESCROW=1 requires ALGORAND_AGENT_ADDRESS + ALGORAND_AGENT_MNEMONIC",
      );
    }
    await ensureAgentUsdcOptIn(address, mnemonic);
    const available = await indexerUsdcBalanceMicro(address);
    const requested = BigInt(
      process.env.X500_EXAMPLE_ESCROW_MICRO_ALGOS?.trim() || "3000000",
    );
    if (available === 0n) {
      throw new Error(
        "Agent USDC balance is 0. ASA opt-in is complete — send testnet USDC again from Circle " +
          "(https://faucet.circle.com/, Algorand Testnet) then re-run: " +
          "X500_EXAMPLE_SETUP_ESCROW=1 pnpm example:setup",
      );
    }
    const micro = requested > available ? available : requested;
    if (micro < 1_000_000n) {
      throw new Error(
        `Agent USDC balance too low (${available} microUSDC); need at least 1 USDC for escrow`,
      );
    }
    if (micro < requested) {
      console.log(
        `[example:setup] depositing ${micro} microUSDC (available balance; requested ${requested})`,
      );
    }
    const x500 = createX500({
      network: "testnet",
      address,
      mnemonic,
    });
    const { transactionId, loraUrl } = await x500.setup({
      escrowMicroAlgos: micro,
    });
    console.log(`[example:setup] escrow tx ${transactionId}`);
    console.log(`[example:setup] ${loraUrl}`);
    await x500.close();
  }

  console.log("\n[example:setup] ready");
  console.log(`  merchant origin: ${origin}`);
  console.log("  next:");
  console.log("    pnpm indexer:dev");
  console.log("    pnpm settler:dev");
  console.log("    pnpm proxy:dev");
  console.log("    pnpm example:server");
  console.log("    pnpm example:agent:smoke   # no Groq key needed");
  console.log("    pnpm example:agent       # LangChain CLI (needs GROQ_API_KEY)");
}

main().catch((err) => {
  console.error("[example:setup] failed:", err);
  process.exit(1);
});
