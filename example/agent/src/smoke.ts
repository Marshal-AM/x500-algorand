/**
 * Smoke test: insured weather call through x500-agent-sdk (no Groq / LangChain).
 */
import { createX500 } from "x500-agent-sdk";
import {
  formatMicroAlgos,
  formatMicroUsdc,
  logPaymentBreakdown,
} from "./payment-log.js";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main(): Promise<void> {
  const address = requireEnv("X500_AGENT_ADDRESS");
  const mnemonic = requireEnv("ALGORAND_AGENT_MNEMONIC");
  const merchantOrigin = requireEnv("X500_MERCHANT_ORIGIN");
  const city = process.argv[2]?.trim() || "Paris";

  const x500 = createX500({
    network: "testnet",
    address,
    mnemonic,
  });

  const balance = await x500.getBalance();
  const resolved = await x500.resolveMerchant(merchantOrigin);
  const url = `${merchantOrigin.replace(/\/$/, "")}/paid/weather?city=${encodeURIComponent(city)}`;

  console.log(`[smoke] agent ${address}`);
  console.log(`[smoke] balance ${formatMicroAlgos(balance)} ALGO`);
  console.log(`[smoke] slug ${resolved.slug}`);
  if (resolved.apiPriceMicroUsdc) {
    console.log(
      `[smoke] api price ${formatMicroUsdc(resolved.apiPriceMicroUsdc)}`,
    );
  }
  console.log(`[smoke] GET ${url}`);

  const res = await x500.fetch(url);
  const text = await res.text();
  console.log(`[smoke] status ${res.status}`);
  console.log(`[smoke] body ${text.slice(0, 600)}`);

  await logPaymentBreakdown({
    x500,
    res,
    bodyText: text,
    configuredApiPriceMicroUsdc: resolved.apiPriceMicroUsdc,
    routeLabel: `GET /paid/weather?city=${city}`,
  });

  await x500.close();
  if (!res.ok) {
    if (res.status === 402) {
      console.error(
        "\n[smoke] 402 — agent likely needs testnet USDC (ASA 10458941) opted in.",
      );
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
