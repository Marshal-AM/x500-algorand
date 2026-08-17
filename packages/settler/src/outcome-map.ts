/** Covered wrap outcomes that map to on-chain breach=true. */
const COVERED = new Set([
  "latency_breach",
  "server_error",
  "network_error",
]);

export function isCoveredBreachOutcome(outcome: string): boolean {
  return COVERED.has(outcome);
}

/** Map SettlementEvent.outcome → SettleBatchCall.outcome. */
export function mapOutcomeToSettle(outcome: string): "ok" | "breach" {
  return isCoveredBreachOutcome(outcome) ? "breach" : "ok";
}
