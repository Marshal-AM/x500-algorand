import type { Outcome } from "./types.js";

export interface EconomicsPool {
  flatPremiumMicroAlgos: bigint;
  imputedCostMicroAlgos: bigint;
}

export interface Economics {
  outcome: Outcome;
  premiumMicroAlgos: bigint;
  refundMicroAlgos: bigint;
  covered: boolean;
}

export function isCoveredBreach(outcome: Outcome): boolean {
  return (
    outcome === "latency_breach" ||
    outcome === "server_error" ||
    outcome === "network_error"
  );
}

function clampPrincipal(requested: bigint, imputedCap: bigint): bigint {
  if (requested < 0n) return 0n;
  if (requested > imputedCap) return imputedCap;
  return requested;
}

/**
 * Premium + refund for a classified outcome (microUSDC).
 *
 * - latency_breach: principal is the Exact x402 amount paid (required).
 * - server_error / network_error: principal is imputed cost (no x402 ticket).
 * Refund = principal + flatPremium. Imputed cap still clamps principal.
 */
export function computeEconomics(args: {
  outcome: Outcome;
  pool: EconomicsPool;
  amountPaid?: bigint;
}): Economics {
  const { outcome, pool, amountPaid } = args;

  if (outcome === "client_error") {
    return {
      outcome,
      premiumMicroAlgos: 0n,
      refundMicroAlgos: 0n,
      covered: false,
    };
  }

  let refund = 0n;
  if (outcome === "latency_breach") {
    const principal = clampPrincipal(amountPaid ?? 0n, pool.imputedCostMicroAlgos);
    refund = principal + pool.flatPremiumMicroAlgos;
  } else if (outcome === "server_error" || outcome === "network_error") {
    const principal = clampPrincipal(
      pool.imputedCostMicroAlgos,
      pool.imputedCostMicroAlgos,
    );
    refund = principal + pool.flatPremiumMicroAlgos;
  }

  return {
    outcome,
    premiumMicroAlgos: pool.flatPremiumMicroAlgos,
    refundMicroAlgos: refund,
    covered: true,
  };
}
