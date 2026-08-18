/**
 * x402 demo: unpaid request → 402, then SDK pay → settlement on Lora.
 *
 * Requires: ALGORAND_AGENT_MNEMONIC, X500_AGENT_ADDRESS, merchant URL in env or arg.
 */
import { createX500, loraTxUrl } from "x500-agent-sdk";

async function main(): Promise<void> {
  const mnemonic = process.env.ALGORAND_AGENT_MNEMONIC?.trim();
  const address = process.env.X500_AGENT_ADDRESS?.trim();
  const merchantUrl =
    process.argv[2]?.trim() ||
    process.env.X500_MERCHANT_PAID_URL?.trim() ||
    "http://127.0.0.1:8790/paid/quote/BTC";

  if (!mnemonic || !address) {
    throw new Error("Set ALGORAND_AGENT_MNEMONIC and X500_AGENT_ADDRESS");
  }

  console.log("\n=== Step 1: unpaid request (expect 402) ===");
  const unpaid = await fetch(merchantUrl);
  console.log("Status:", unpaid.status);
  if (unpaid.status !== 402) {
    console.warn("Expected 402 — merchant may not require payment on this route");
  }

  console.log("\n=== Step 2: SDK pay (GoPlausible x402) ===");
  const client = createX500({
    network: "testnet",
    address,
    mnemonic,
  });

  const res = await client.pay(merchantUrl);
  console.log("Status:", res.status);
  const body = await res.text();
  console.log("Body:", body.slice(0, 500));

  const settlementHeader =
    res.headers.get("payment-response") ??
    res.headers.get("x-payment-response");
  if (settlementHeader) {
    console.log("\n=== Payment settled ===");
    console.log("Header:", settlementHeader.slice(0, 200));
  }

  console.log("\n=== View on Lora ===");
  console.log("After settlement, open your wallet tx history or check facilitator response for tx id.");
  console.log("Explorer base:", loraTxUrl("YOUR_TX_ID_HERE"));

  await client.close();
}

main().catch((err) => {
  console.error("[algorand-x402-demo] failed:", err);
  process.exit(1);
});
