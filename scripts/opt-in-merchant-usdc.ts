/**
 * Opt the merchant payTo account into testnet USDC (ASA 10458941).
 * x402 Exact transfers fail with "receiver error: must opt-in" until this runs.
 */
import algosdk from "algosdk";

const USDC = 10458941;

async function main(): Promise<void> {
  const mnemonic = process.env.ALGORAND_MERCHANT_MNEMONIC?.trim();
  const expected = process.env.ALGORAND_MERCHANT_ADDRESS?.trim();
  if (!mnemonic) {
    throw new Error(
      "ALGORAND_MERCHANT_MNEMONIC required (bootstrap historically omitted this key)",
    );
  }

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const address = account.addr.toString();
  if (expected && expected !== address) {
    throw new Error(
      `merchant mnemonic address ${address} does not match ALGORAND_MERCHANT_ADDRESS`,
    );
  }

  const algod = new algosdk.Algodv2(
    "",
    process.env.ALGORAND_ALGOD_URL?.trim() ??
      "https://testnet-api.algonode.cloud",
    "",
  );

  const info = await algod.accountInformation(address).do();
  const optedIn = info.assets?.some((a) => Number(a["asset-id"]) === USDC);
  console.log(`merchant ${address}`);
  console.log(`usdc_opted_in ${Boolean(optedIn)}`);
  if (optedIn) {
    console.log("[ok] already opted into USDC");
    return;
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
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
