import type { SettlementEvent } from "@x500/wrap";
import {
  assetFromSettlement,
  pushIndexerEvent,
  type IndexerPushBody,
} from "@x500/wrap";

export type { IndexerPushBody };
export { pushIndexerEvent };

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

export function settledIndexerBody(opts: {
  callId: string;
  agentAddress: string;
  endpointSlug: string;
  outcome: string;
  latencyMs: number;
  premiumMicroAlgos: string;
  refundMicroAlgos: string;
  breach: boolean;
  settlementTxId: string;
  network: string;
  asset: string;
}): IndexerPushBody {
  return {
    ...opts,
    status: "settled",
    asset: assetFromSettlement(opts.asset),
  };
}
