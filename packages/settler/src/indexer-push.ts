import type { SettlementEvent } from "@x500/wrap";

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
  settlementTxId: string;
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

export function eventFromPayload(
  payload: Record<string, unknown>,
): Pick<
  SettlementEvent,
  | "callId"
  | "agentAddress"
  | "endpointSlug"
  | "premiumMicroAlgos"
  | "refundMicroAlgos"
  | "latencyMs"
  | "outcome"
  | "network"
  | "asset"
> {
  const callId = String(payload.callId ?? "");
  const agentAddress = String(
    payload.agentAddress ?? payload.agent_address ?? "",
  );
  const endpointSlug = String(payload.endpointSlug ?? "");
  if (!callId || !agentAddress || !endpointSlug) {
    throw new Error("settle job payload missing callId/agentAddress/endpointSlug");
  }
  const network = String(payload.network ?? "algorand:testnet");
  const assetRaw = String(payload.asset ?? "algo");
  const asset: SettlementEvent["asset"] =
    assetRaw === "10458941" ? "10458941" : "algo";
  if (network !== "algorand:testnet") {
    throw new Error(`settle job rejected network: ${network}`);
  }
  return {
    callId,
    agentAddress,
    endpointSlug,
    premiumMicroAlgos: String(
      payload.premiumMicroAlgos ?? payload.premium_micro_algos ?? "0",
    ),
    refundMicroAlgos: String(
      payload.refundMicroAlgos ?? payload.refund_micro_algos ?? "0",
    ),
    latencyMs: Number(payload.latencyMs ?? 0),
    outcome: String(payload.outcome ?? "ok") as SettlementEvent["outcome"],
    network: "algorand:testnet",
    asset,
  };
}
