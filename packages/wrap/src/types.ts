/** Covered-breach matrix (refundable): latency_breach, server_error, network_error. */

export type Outcome =
  | "ok"
  | "latency_breach"
  | "server_error"
  | "client_error"
  | "network_error";

export type VerdictSource = "x500_observed" | "client_attested" | "oracle";

export const ALGORAND_TESTNET = "algorand:testnet" as const;
export const USDC_TESTNET_ASA_ID = "10458941" as const;
export const NATIVE_ALGO_ASSET = "algo" as const;

export interface EndpointConfig {
  slug: string;
  sla_latency_ms: number;
  /** Flat insurance premium per covered call (microUSDC in pool escrow). */
  flat_premium_micro_algos: bigint;
  /** Refund principal ceiling (microUSDC). */
  imputed_cost_micro_algos: bigint;
  /** Registered merchant x402 API price (microUSDC). */
  api_price_micro_usdc: bigint;
}

/**
 * Settlement event published after every wrapped call.
 * bigint money fields are decimal strings for JSON safety.
 */
export interface SettlementEvent {
  callId: string;
  agentAddress: string;
  endpointSlug: string;
  premiumMicroAlgos: string;
  refundMicroAlgos: string;
  latencyMs: number;
  outcome: Outcome;
  ts: string;
  network: typeof ALGORAND_TESTNET;
  asset: typeof USDC_TESTNET_ASA_ID | typeof NATIVE_ALGO_ASSET;
  verdictSource?: VerdictSource;
}

export function assertUsdcAsset(asset: string): void {
  if (asset !== USDC_TESTNET_ASA_ID) {
    throw new Error(
      `x500: x402 asset must be USDC ASA (${USDC_TESTNET_ASA_ID}); got ${JSON.stringify(asset)}`,
    );
  }
}

export function assertAlgorandTestnet(network: string): void {
  if (network !== ALGORAND_TESTNET) {
    throw new Error(
      `x500: network must be ${ALGORAND_TESTNET}; got ${JSON.stringify(network)}`,
    );
  }
}
