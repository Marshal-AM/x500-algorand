import type { X500Client } from "x500-sdk-algorand";
import { loraTxUrl } from "x500-sdk-algorand";
import type { LogSink } from "./log-sink";

const LORA_BASE = "https://lora.algokit.io/testnet/transaction";

export function formatMicroAlgos(
  micro: bigint | string | null | undefined,
): string {
  if (micro === null || micro === undefined) return "0.000000";
  const n = BigInt(micro);
  const whole = n / 1_000_000n;
  const frac = (n % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

export function formatMicroUsdc(
  micro: bigint | string | null | undefined,
): string {
  if (micro === null || micro === undefined) return "0.000000";
  const n = BigInt(micro);
  const whole = n / 1_000_000n;
  const frac = (n % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac} USDC`;
}

export function algorandTxExplorerUrl(txId: string): string {
  return loraTxUrl(txId);
}

export async function logPaymentBreakdown(opts: {
  x500: X500Client;
  res: Response;
  bodyText?: string;
  configuredApiPriceMicroUsdc?: string | null;
  routeLabel?: string;
  sink: LogSink;
}): Promise<void> {
  const { res, routeLabel, sink } = opts;
  const callId = res.headers.get("x-x500-call-id");
  const premium = res.headers.get("x-x500-premium") ?? "0";
  const refund = res.headers.get("x-x500-refund") ?? "0";
  const outcome = res.headers.get("x-x500-outcome") ?? "n/a";

  sink.log("\n── x500 payment breakdown ──");
  if (routeLabel) sink.log(`Route: ${routeLabel}`);
  sink.log(`Call ID: ${callId ?? "n/a"}`);
  sink.log(`Outcome: ${outcome}`);
  sink.log(`Insurance premium: ${formatMicroAlgos(premium)} ALGO`);
  if (BigInt(refund) > 0n) {
    sink.log(`Refund: ${formatMicroAlgos(refund)} ALGO`);
  }
  sink.log(`View txs on ${LORA_BASE}/`);
}
