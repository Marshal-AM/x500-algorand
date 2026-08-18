import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadDeployments } from "x500-protocol-algorand-v1-client";

/** Live Algorand testnet defaults (V1). Override via env or createX500 options. */
export const DEFAULT_MARKET_PROXY_URL = "http://127.0.0.1:8788" as const;
export const DEFAULT_INDEXER_URL = "http://127.0.0.1:8787" as const;
export const DEFAULT_FACILITATOR_URL =
  "https://facilitator.goplausible.xyz" as const;

/** Testnet pool app id — escrow deposits for agent insurance premiums. */
export const DEFAULT_POOL_APP_ID = 0 as const;

function poolAppIdFromDeployments(): number | null {
  const path =
    process.env.X500_DEPLOYMENTS_PATH?.trim() ||
    join(process.cwd(), "config", "deployments.algorand.testnet.json");
  if (!existsSync(path)) return null;
  try {
    return loadDeployments(path).pool.appId;
  } catch {
    return null;
  }
}

/** Resolve pool app id from env, deployments file, or default. */
export function resolveDefaultPoolAppId(): number {
  const env = process.env.X500_POOL_APP_ID?.trim();
  if (env) return Number(env);
  const fromFile = poolAppIdFromDeployments();
  if (fromFile != null && fromFile > 0) return fromFile;
  return DEFAULT_POOL_APP_ID;
}

export function insuredProxyUrl(
  slug: string,
  path = "",
  proxyBase: string = DEFAULT_MARKET_PROXY_URL,
): string {
  const base = proxyBase.replace(/\/$/, "");
  const suffix = path.replace(/^\//, "");
  return suffix ? `${base}/v1/${slug}/${suffix}` : `${base}/v1/${slug}`;
}

export const LORA_EXPLORER_BASE =
  "https://lora.algokit.io/testnet/transaction" as const;

export function loraTxUrl(txId: string): string {
  return `${LORA_EXPLORER_BASE}/${txId}`;
}
