/**
 * Operator tops up pool liquidity for an endpoint slug (USDC microUnits).
 * Default: 1 USDC = 1_000_000 microUSDC. Override X500_TOPUP_MICRO_ALGOS.
 */
import algosdk from "algosdk";
import { encodeSlug, encodeTopUp } from "x500-protocol-algorand-v1-client";
import {
  algodClient,
  deployments,
  operatorAccount,
  submitAppCall,
} from "./lib/algorand.js";

const USDC_TESTNET_ASA_ID = 10458941;

async function main(): Promise<void> {
  const slug = process.env.X500_TOPUP_SLUG?.trim() || "pay-default";
  const micro =
    process.env.X500_TOPUP_MICRO_ALGOS?.trim() !== undefined
      ? BigInt(process.env.X500_TOPUP_MICRO_ALGOS.trim())
      : 1_000_000n;

  const d = deployments();
  const account = operatorAccount();
  const algod = algodClient();
  const suggestedParams = await algod.getTransactionParams().do();
  const poolAddr = algosdk.getApplicationAddress(d.pool.appId);
  const axferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: poolAddr,
    assetIndex: USDC_TESTNET_ASA_ID,
    amount: micro,
    suggestedParams,
  });

  const txid = await submitAppCall({
    appId: d.pool.appId,
    appArgs: encodeTopUp(slug),
    boxes: [{ appIndex: d.pool.appId, name: encodeSlug(slug) }],
    assetTransfer: axferTxn,
  });
  console.log(`[ok] topUp ${slug} ${micro} microUSDC → ${txid}`);
}

main().catch((err) => {
  console.error("[fail] topup-pool-algorand", err);
  process.exit(1);
});
