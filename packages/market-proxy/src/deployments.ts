/**
 * Bundled testnet protocol deployments — update after pnpm protocol:deploy
 */
export const TESTNET_DEPLOYMENTS = {
  network: "algorand:testnet" as const,
  deployedAt: "2026-08-17T00:00:00.000Z",
  authorityAddress: "PLACEHOLDER_AUTHORITY",
  registry: { appId: 0, address: "PLACEHOLDER_REGISTRY" },
  pool: { appId: 0, address: "PLACEHOLDER_POOL" },
  settler: { appId: 0, address: "PLACEHOLDER_SETTLER" },
};
