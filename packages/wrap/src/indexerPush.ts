import { USDC_TESTNET_ASA_ID, ALGORAND_TESTNET } from "./types.js";

export interface IndexerPushBody {
  callId: string;
  agentAddress: string;
  endpointSlug: string;
  outcome: string;
  latencyMs: number;
  premiumMicroAlgos: string;
  refundMicroAlgos: string;
  breach: boolean;
  status: string;
  settlementTxId?: string;
  network: string;
  asset: string;
}

export async function pushIndexerEvent(opts: {
  indexerUrl: string;
  pushSecret: string;
  body: IndexerPushBody;
  fetchImpl?: typeof fetch;
  retries?: number;
}): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = opts.indexerUrl.replace(/\/$/, "");
  const retries = opts.retries ?? 3;
  let lastErr: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetchImpl(`${base}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-indexer-push-secret": opts.pushSecret,
        },
        body: JSON.stringify(opts.body),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`indexer HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      let parsed: { ok?: boolean; error?: string } = {};
      try {
        parsed = JSON.parse(text) as { ok?: boolean; error?: string };
      } catch {
        /* empty */
      }
      if (parsed.ok === false) {
        throw new Error(`indexer rejected: ${parsed.error ?? text}`);
      }
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("indexer push failed");
}

export function breachFromOutcome(outcome: string): boolean {
  return outcome === "latency_breach" || outcome === "breach";
}

export function assetFromSettlement(asset?: string): string {
  return asset === USDC_TESTNET_ASA_ID ? USDC_TESTNET_ASA_ID : "algo";
}

export function pendingIndexerBody(opts: {
  callId: string;
  agentAddress: string;
  endpointSlug: string;
  outcome: string;
  latencyMs: number;
  premiumMicroAlgos: bigint;
  refundMicroAlgos: bigint;
  asset?: string;
}): IndexerPushBody {
  return {
    callId: opts.callId,
    agentAddress: opts.agentAddress,
    endpointSlug: opts.endpointSlug,
    outcome: opts.outcome,
    latencyMs: opts.latencyMs,
    premiumMicroAlgos: opts.premiumMicroAlgos.toString(),
    refundMicroAlgos: opts.refundMicroAlgos.toString(),
    breach: breachFromOutcome(opts.outcome),
    status: "pending_settlement",
    network: ALGORAND_TESTNET,
    asset: assetFromSettlement(opts.asset),
  };
}
