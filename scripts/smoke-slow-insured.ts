import algosdk from "algosdk";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ALGORAND_TESTNET_CAIP2, type ClientAvmSigner } from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { wrapFetchWithPayment } from "../packages/x500-sdk-algorand/src/wrapFetchWithPayment.ts";

async function main(): Promise<void> {
  const mnemonic = process.env.ALGORAND_AGENT_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("mnemonic required");
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const signer: ClientAvmSigner = {
    address: account.addr.toString(),
    signTransactions: async (txns) =>
      txns.map((txnBytes) => {
        const txn = algosdk.decodeUnsignedTransaction(txnBytes);
        return algosdk.signTransaction(txn, account.sk).blob;
      }),
  };
  const client = new x402Client();
  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));
  const payFetch = wrapFetchWithPayment(fetch, client);

  const url =
    process.env.PROBE_URL?.trim() ??
    "http://127.0.0.1:8801/paid/weather?city=London";
  console.log("insured slow GET", url);
  const t0 = Date.now();
  const res = await payFetch(url, {
    headers: { "x-x500-agent-address": account.addr.toString() },
  });
  const ms = Date.now() - t0;
  console.log("status", res.status, `(${ms}ms)`);
  console.log("outcome", res.headers.get("x-x500-outcome"));
  console.log("premium", res.headers.get("x-x500-premium"));
  console.log("refund", res.headers.get("x-x500-refund"));
  console.log("body", (await res.text()).slice(0, 200));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
