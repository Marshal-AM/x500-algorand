/** Algorand-only VM family for x500 V1. */
export type ChainVm = "algorand";

export const ALGORAND_TESTNET = "algorand:testnet" as const;
export const USDC_TESTNET_ASA_ID = "10458941" as const;
export const NATIVE_ALGO_ASSET = "algo" as const;

export interface ChainDescriptor {
  vm: ChainVm;
  network: typeof ALGORAND_TESTNET;
  usdcAsaId: typeof USDC_TESTNET_ASA_ID;
  /** MicroAlgos per whole ALGO (10^6). */
  algoDecimals: 6;
  indexerUrl: string;
  algodUrl: string;
}

export const ALGORAND_TESTNET_CHAIN: ChainDescriptor = {
  vm: "algorand",
  network: ALGORAND_TESTNET,
  usdcAsaId: USDC_TESTNET_ASA_ID,
  algoDecimals: 6,
  indexerUrl: "https://testnet-idx.algonode.cloud",
  algodUrl: "https://testnet-api.algonode.cloud",
};

export class Phase2RequiredError extends Error {
  readonly code = "PHASE2_REQUIRED" as const;
  constructor(method: string) {
    super(
      `Phase2RequiredError: ${method} requires on-chain Registry/Pool/Settler (Phase 2). Not available yet.`,
    );
    this.name = "Phase2RequiredError";
  }
}

export interface EndpointConfigSnapshot {
  slug: string;
  authorityAddress: string;
  ownerAddress: string;
  paused: boolean;
  slaLatencyMs: number;
  flatPremiumMicroAlgos: bigint;
  imputedCostMicroAlgos: bigint;
  apiPriceMicroUsdc: bigint;
  hostname: string;
  contactAddress: string;
  raw: unknown;
}

export interface SettleBatchCall {
  callId: string;
  agentAddress: string;
  premiumMicroAlgos: bigint;
  refundMicroAlgos: bigint;
  outcome: "ok" | "breach";
  latencyMs: number;
}

export interface SettleBatchInput {
  slug: string;
  calls: ReadonlyArray<SettleBatchCall>;
}

export interface SettleBatchResult {
  transactionId: string;
}

export interface AgentEligibility {
  eligible: boolean;
  /** Weak V1: balance ≥ premium only (prepaid escrow is operator-side). */
  mode: "balance_gte_premium_weak";
  algoMicroAlgos: bigint;
  requiredMicroAlgos: bigint;
  reason?: string;
}

export interface ChainAdapter {
  readonly chain: ChainDescriptor;
  readEndpointConfigs(): Promise<ReadonlyArray<EndpointConfigSnapshot>>;
  getEndpoint(slug: string): Promise<EndpointConfigSnapshot | null>;
  getProtocolPaused(): Promise<boolean>;
  isCallSettled(callId: string): Promise<boolean>;
  submitSettleBatch(input: SettleBatchInput): Promise<SettleBatchResult>;
  getNativeAlgoBalance(address: string): Promise<bigint>;
  checkAgentEligibility(
    address: string,
    premiumMicroAlgos: bigint,
  ): Promise<AgentEligibility>;
}
