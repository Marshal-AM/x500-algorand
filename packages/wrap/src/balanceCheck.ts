export type BalanceCheckRejectionReason =
  | "insufficient_balance"
  | "insufficient_allowance";

export type BalanceCheckResult =
  | { eligible: true; algoMicroAlgos: bigint }
  | {
      eligible: false;
      reason: BalanceCheckRejectionReason;
      algoMicroAlgos?: bigint;
    };

export interface BalanceCheck {
  /** requiredMicroAlgos = premium to debit for this call. */
  check(
    agentAddress: string,
    requiredMicroAlgos: bigint,
  ): Promise<BalanceCheckResult>;
}
