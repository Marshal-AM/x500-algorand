import { loadDeployments } from "x500-protocol-algorand-v1-client";

/**
 * Load testnet protocol deployments from X500_DEPLOYMENTS_PATH (or default config path).
 */
export function getTestnetDeployments() {
  const path = process.env.X500_DEPLOYMENTS_PATH?.trim();
  return loadDeployments(path || undefined);
}
