import type { X500Client } from "x500-agent-sdk";
import { loraTxUrl } from "x500-agent-sdk";
import type { LogSink } from "./log-sink";

const ALGORAND_TX_RE = /^[A-Z2-7]{52}$/;

export function formatMicroUsdc(
  micro: bigint | string | null | undefined,
): string {
  if (micro === null || micro === undefined) return "0.000000 USDC";
  const n = BigInt(micro);
  const whole = n / 1_000_000n;
  const frac = (n % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac} USDC`;
}

export function algorandTxExplorerUrl(txId: string): string {
  return loraTxUrl(txId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function asTxId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return ALGORAND_TX_RE.test(trimmed) ? trimmed : null;
}

function decodeJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  try {
    candidates.push(Buffer.from(trimmed, "base64").toString("utf8"));
  } catch {
    /* ignore */
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function txFromSettleObject(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null;
  return (
    asTxId(obj.transaction) ??
    asTxId(obj.transactionId) ??
    asTxId(obj.txId) ??
    asTxId(obj.txid)
  );
}

/** x402 Exact settle receipt lives in PAYMENT-RESPONSE (base64 JSON). */
export function parseX402PaymentTxId(
  res: Response,
  bodyText?: string,
): string | null {
  const header =
    res.headers.get("payment-response") ??
    res.headers.get("x-payment-response");
  if (header) {
    const fromHeader =
      txFromSettleObject(decodeJsonObject(header)) ?? asTxId(header);
    if (fromHeader) return fromHeader;
  }

  if (!bodyText?.trim()) return null;
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    const nested =
      typeof body.settlementTxId === "string"
        ? txFromSettleObject(decodeJsonObject(body.settlementTxId))
        : null;
    return asTxId(body.settlementTxId) ?? asTxId(body.transaction) ?? nested;
  } catch {
    return null;
  }
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
  sink: LogSink;
}): Promise<void> {
  const { x500, res, bodyText, configuredApiPriceMicroUsdc, routeLabel, sink } =
    opts;
  const callId = res.headers.get("x-x500-call-id");
  const premium = res.headers.get("x-x500-premium") ?? "0";
  const refund = res.headers.get("x-x500-refund") ?? "0";
  const outcome = res.headers.get("x-x500-outcome") ?? "n/a";
  const settlementPending =
    res.headers.get("x-x500-settlement-pending") === "1";
  const refundAmount = BigInt(refund);

  const x402Tx = parseX402PaymentTxId(res, bodyText);
  const insuranceTx = callId
    ? await fetchInsuranceSettlementTx(x500, callId, settlementPending)
    : null;

  sink.log("\n── x500 payment breakdown ──");
  if (routeLabel) sink.log(`Route: ${routeLabel}`);
  sink.log(`Call ID: ${callId ?? "n/a"}`);
  sink.log(`Outcome: ${outcome}`);
  sink.log(`HTTP status: ${res.status}`);
  if (configuredApiPriceMicroUsdc) {
    sink.log(`x402 payment: ${formatMicroUsdc(configuredApiPriceMicroUsdc)}`);
  }
  if (x402Tx) {
    sink.log(`x402 settlement: ${algorandTxExplorerUrl(x402Tx)}`);
  }
  sink.log(`Insurance premium: ${formatMicroUsdc(premium)}`);
  if (insuranceTx) {
    sink.log(`Insurance settlement: ${algorandTxExplorerUrl(insuranceTx)}`);
  } else if (settlementPending && refundAmount === 0n) {
    sink.log("Insurance settlement: pending (settler)");
  }
  if (refundAmount > 0n) {
    sink.log(`Refund: ${formatMicroUsdc(refund)}`);
    if (insuranceTx) {
      sink.log(`Refund settlement: ${algorandTxExplorerUrl(insuranceTx)}`);
    } else if (settlementPending) {
      sink.log("Refund settlement: pending (settler)");
    }
  }
}
