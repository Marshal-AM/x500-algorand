/**
 * Ensure agent is opted into testnet USDC ASA (required for on-chain refunds).
 */
import algosdk from "algosdk";
import { indexerUsdcBalanceMicro } from "x500-protocol-algorand-v1-client";

const USDC = 10458941;

async function main(): Promise<void> {
  const mnemonic = process.env.ALGORAND_AGENT_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("ALGORAND_AGENT_MNEMONIC required");

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const address = account.addr.toString();
  const algod = new algosdk.Algodv2(
    "",
    process.env.ALGORAND_ALGOD_URL?.trim() ??
      "https://testnet-api.algonode.cloud",
    "",
  );

  const info = await algod.accountInformation(address).do();
  const algo = Number(info.amount) / 1e6;
  const optedIn = info.assets?.some((a) => Number(a["asset-id"]) === USDC);
  const usdcIndexer = await indexerUsdcBalanceMicro(address);

  console.log(`agent ${address}`);
  console.log(`algo ${algo}`);
  console.log(`usdc_opted_in ${optedIn}`);
  console.log(`usdc_balance_indexer ${Number(usdcIndexer) / 1e6}`);

  if (optedIn) {
    console.log("[ok] already opted into USDC");
    return;
  }

  if (algo < 0.2) {
    throw new Error("agent needs at least ~0.2 ALGO for ASA opt-in min balance");
  }

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
  console.log(`[ok] USDC opt-in tx=${txid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
