/** Live Algorand testnet defaults (V1). Override via env or createX500 options. */
export const DEFAULT_MARKET_PROXY_URL = "http://127.0.0.1:8788" as const;
export const DEFAULT_INDEXER_URL = "http://127.0.0.1:8787" as const;
export const DEFAULT_FACILITATOR_URL =
  "https://facilitator.goplausible.xyz" as const;

/** Testnet pool app id — escrow deposits for agent insurance premiums. */
export const DEFAULT_POOL_APP_ID = 0 as const;

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
