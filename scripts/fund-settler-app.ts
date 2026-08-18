import algosdk from "algosdk";
import { loadDeployments } from "x500-protocol-algorand-v1-client";
import { algodClient } from "./lib/algorand.js";

async function main(): Promise<void> {
  const mnemonic = process.env.ALGORAND_SETTLER_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("ALGORAND_SETTLER_MNEMONIC required");
  const settler = algosdk.mnemonicToSecretKey(mnemonic);
  const d = loadDeployments(process.env.X500_DEPLOYMENTS_PATH);
  const appAddr = d.settler.address;
  const algod = algodClient();
  const suggestedParams = await algod.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: settler.addr,
    receiver: appAddr,
    amount: 500_000,
    suggestedParams,
  });
  const signed = txn.signTxn(settler.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
  console.log(`[ok] settler app ${appAddr} funded +0.5 ALGO tx=${txid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
