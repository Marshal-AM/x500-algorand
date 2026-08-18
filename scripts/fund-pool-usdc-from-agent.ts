/**
 * Send USDC from agent to operator and top up pool slug liquidity.
 */
import algosdk from "algosdk";
import { encodeSlug, encodeTopUp } from "x500-protocol-algorand-v1-client";
import {
  algodClient,
  deployments,
  operatorAccount,
  submitAppCall,
} from "./lib/algorand.js";

const USDC = 10458941;

async function ensureUsdcOptIn(
  account: algosdk.Account,
  algod: algosdk.Algodv2,
): Promise<void> {
  const addr = account.addr.toString();
  const info = await algod.accountInformation(addr).do();
  const optedIn = info.assets?.some((a) => Number(a["asset-id"]) === USDC);
  if (optedIn) return;
  const suggestedParams = await algod.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    assetIndex: USDC,
    amount: 0,
    suggestedParams,
  });
  const signed = txn.signTxn(account.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
  console.log(`[ok] ${addr} USDC opt-in tx=${txid}`);
}

async function main(): Promise<void> {
  const agentMnemonic = process.env.ALGORAND_AGENT_MNEMONIC?.trim();
  const operatorAddr = process.env.ALGORAND_OPERATOR_ADDRESS?.trim();
  if (!agentMnemonic || !operatorAddr) {
    throw new Error("ALGORAND_AGENT_MNEMONIC and ALGORAND_OPERATOR_ADDRESS required");
  }

  const agent = algosdk.mnemonicToSecretKey(agentMnemonic);
  const operator = operatorAccount();
  const algod = algodClient();
  const topupMicro = BigInt(
    process.env.X500_TOPUP_MICRO_ALGOS?.trim() || "5000000",
  );
  const transferMicro = topupMicro + 500_000n;

  await ensureUsdcOptIn(operator, algod);

  const suggestedParams = await algod.getTransactionParams().do();
  const fundTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: agent.addr,
    receiver: operator.addr,
    assetIndex: USDC,
    amount: transferMicro,
    suggestedParams,
  });
  const signed = fundTxn.signTxn(agent.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
  console.log(`[ok] agent → operator ${transferMicro} microUSDC tx=${txid}`);

  const d = deployments();
  const slug = process.env.X500_TOPUP_SLUG?.trim() || "pay-default";
  const poolAddr = algosdk.getApplicationAddress(d.pool.appId);
  const axferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: operator.addr,
    receiver: poolAddr,
    assetIndex: USDC,
    amount: topupMicro,
    suggestedParams: await algod.getTransactionParams().do(),
  });
  const topTx = await submitAppCall({
    appId: d.pool.appId,
    appArgs: encodeTopUp(slug),
    boxes: [{ appIndex: d.pool.appId, name: encodeSlug(slug) }],
    assetTransfer: axferTxn,
  });
  console.log(`[ok] pool topUp ${slug} ${topupMicro} microUSDC tx=${topTx}`);
}

main().catch((err) => {
  console.error("[fail] fund-pool-usdc", err);
  process.exit(1);
});
