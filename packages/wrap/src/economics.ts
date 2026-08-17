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

/**
 * Premium + refund for a classified outcome (microAlgos).
 *
 * Covered breach refund = principal + flatPremium, with principal =
 * amountPaid (if provided) else imputedCost, clamped to imputedCost.
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
  if (isCoveredBreach(outcome)) {
    const requested =
      amountPaid === undefined ? pool.imputedCostMicroAlgos : amountPaid;
    const principal =
      requested < 0n
        ? 0n
        : requested > pool.imputedCostMicroAlgos
          ? pool.imputedCostMicroAlgos
          : requested;
    refund = principal + pool.flatPremiumMicroAlgos;
  }

  return {
    outcome,
    premiumMicroAlgos: pool.flatPremiumMicroAlgos,
    refundMicroAlgos: refund,
    covered: true,
  };
}
