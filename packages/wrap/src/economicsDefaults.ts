/**
 * USDC micro-unit defaults mirroring Hedera tinybar defaults at 6-decimal scale.
 *
 * Hedera: 1_000_000 tinybars = 0.01 HBAR, 10_000_000 tinybars = 0.1 HBAR.
 * USDC:   10_000 microUSDC = 0.01 USDC, 100_000 microUSDC = 0.1 USDC.
 */
export const DEFAULT_FLAT_PREMIUM_MICRO_USDC = 10_000n;
export const DEFAULT_IMPUTED_COST_MICRO_USDC = 100_000n;

/** Legacy Algorand port mistakenly used tinybar-scale integers as microUSDC. */
export const LEGACY_FLAT_PREMIUM_MICRO_USDC = 1_000_000n;
export const LEGACY_IMPUTED_COST_MICRO_USDC = 10_000_000n;
