/**
 * Operator tops up pool liquidity for an endpoint slug (ALGO microUnits).
 * Default: 1 ALGO = 1_000_000 microAlgos. Override X500_TOPUP_MICRO_ALGOS.
 */
import algosdk from "algosdk";
import { encodeSlug, encodeTopUp } from "@x500/protocol-algorand-v1-client";
import {
  algodClient,
  deployments,
  operatorAccount,
  submitAppCall,
} from "./lib/algorand.js";

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
  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: algosdk.getApplicationAddress(d.pool.appId),
    amount: micro,
    suggestedParams,
  });

  const txid = await submitAppCall({
    appId: d.pool.appId,
    appArgs: [encodeTopUp(slug)],
    boxes: [{ appIndex: d.pool.appId, name: encodeSlug(slug) }],
    payment: payTxn,
  });
  console.log(`[ok] topUp ${slug} ${micro} microAlgos → ${txid}`);
}

main().catch((err) => {
  console.error("[fail] topup-pool-algorand", err);
  process.exit(1);
});
