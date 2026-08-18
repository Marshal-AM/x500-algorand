import algosdk from "algosdk";
import { x402Client } from "@x402/core/client";
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
    "http://127.0.0.1:8788/v1/pay-default/paid/weather?city=Paris";
  console.log("1st request", url);
  try {
    const res = await payFetch(url, {
      headers: {
        "x-x500-agent-address": account.addr.toString(),
      },
    });
    console.log("final status", res.status);
    console.log("payment-response", res.headers.get("payment-response"));
    console.log("body", (await res.text()).slice(0, 300));
  } catch (err) {
    console.error("payFetch error", err);
  }

  const direct =
    "http://127.0.0.1:8800/paid/weather?city=Paris";
  console.log("\ndirect merchant", direct);
  try {
    const res2 = await payFetch(direct);
    console.log("direct status", res2.status);
    console.log("payment-response", res2.headers.get("payment-response"));
    console.log("body", (await res2.text()).slice(0, 300));
  } catch (err) {
    console.error("direct payFetch error", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
