import type { X500Client } from "x500-sdk-algorand";
import { loraTxUrl } from "x500-sdk-algorand";

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchInsuranceSettlementTx(
  x500: X500Client,
  callId: string,
  settlementPending: boolean,
): Promise<string | null> {
  const attempts = settlementPending ? 12 : 3;
  for (let i = 0; i < attempts; i++) {
    const data = (await x500.getCall(callId)) as {
      call?: { settlement_tx_id?: string | null; status?: string };
    };
    const tx = data?.call?.settlement_tx_id?.trim();
    if (tx) return tx;
    if (!settlementPending && data?.call?.status === "settled") break;
    if (i < attempts - 1) await sleep(1500);
  }
  return null;
}

export async function logPaymentBreakdown(opts: {
  x500: X500Client;
  res: Response;
  bodyText?: string;
  configuredApiPriceMicroUsdc?: string | null;
  routeLabel?: string;
}): Promise<void> {
  const { x500, res, routeLabel } = opts;
  const callId = res.headers.get("x-x500-call-id");
  const premium = res.headers.get("x-x500-premium") ?? "0";
  const refund = res.headers.get("x-x500-refund") ?? "0";
  const outcome = res.headers.get("x-x500-outcome") ?? "n/a";
  const settlementPending =
    res.headers.get("x-x500-settlement-pending") === "1";

  const insuranceTx = callId
    ? await fetchInsuranceSettlementTx(x500, callId, settlementPending)
    : null;

  console.log("\n── x500 payment breakdown ──");
  if (routeLabel) console.log(`Route: ${routeLabel}`);
  console.log(`Call ID: ${callId ?? "n/a"}`);
  console.log(`Outcome: ${outcome}`);
  console.log(`HTTP status: ${res.status}`);
  console.log(`Insurance premium: ${formatMicroAlgos(premium)} ALGO`);
  if (BigInt(refund) > 0n) {
    console.log(`Refund: ${formatMicroAlgos(refund)} ALGO`);
  }
  if (insuranceTx) {
    console.log(`Insurance settlement: ${loraTxUrl(insuranceTx)}`);
  } else if (settlementPending) {
    console.log("Insurance settlement: pending (settler)");
  }
  console.log("");
}
