import algosdk from "algosdk";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ALGORAND_TESTNET_CAIP2, type ClientAvmSigner } from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/client";

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
  const http = new x402HTTPClient(client);

  const url = "http://127.0.0.1:8800/paid/weather?city=Paris";
  const res = await fetch(url);
  console.log("merchant 402 status", res.status);
  const pr = http.getPaymentRequiredResponse(
    (n) => res.headers.get(n),
    undefined,
  );
  console.log("x402Version", pr.x402Version);
  console.log("accepts", pr.accepts?.length);

  const payload = await client.createPaymentPayload(pr);
  console.log("payload version", payload.x402Version);
  const headers = http.encodePaymentSignatureHeader(payload);
  console.log("payment headers keys", Object.keys(headers));

  const res2 = await fetch(url, { headers });
  console.log("paid status", res2.status);
  console.log("payment-response", res2.headers.get("payment-response"));
  console.log("body", (await res2.text()).slice(0, 400));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
