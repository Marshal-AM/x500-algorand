import {
  DEFAULT_INDEXER_URL,
  DEFAULT_MARKET_PROXY_URL,
  insuredProxyUrl,
} from "./defaults.js";

export interface ResolvedMerchant {
  slug: string;
  hostname: string;
  insuredUrl: string;
  apiPriceMicroUsdc?: string;
  flatPremiumMicroAlgos?: string;
  paused?: boolean;
}

export function normalizeMerchantOrigin(input: string): string {
  const trimmed = input.trim();
  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  const url = new URL(withScheme);
  return `${url.protocol}//${url.host}`.replace(/\/$/, "");
}

export function splitMerchantUrl(input: string): { origin: string; path: string } {
  const trimmed = input.trim();
  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  const url = new URL(withScheme);
  const origin = `${url.protocol}//${url.host}`.replace(/\/$/, "");
  const path = `${url.pathname.replace(/^\//, "")}${url.search}`;
  return { origin, path };
}

export async function resolveMerchant(
  origin: string,
  opts?: {
    indexerUrl?: string;
    proxyBase?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<ResolvedMerchant> {
  const normalized = normalizeMerchantOrigin(origin);
  const indexer = (opts?.indexerUrl ?? DEFAULT_INDEXER_URL).replace(/\/$/, "");
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const res = await fetchImpl(
    `${indexer}/api/endpoints/resolve?origin=${encodeURIComponent(normalized)}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `merchant not registered for origin ${normalized} (indexer ${res.status}${body ? `: ${body}` : ""})`,
    );
  }
  const body = (await res.json()) as {
    endpoint?: {
      slug: string;
      hostname: string;
      paused?: boolean;
      api_price_micro_usdc?: number;
      flat_premium_micro_algos?: number;
    };
    error?: string;
  };
  if (body.error || !body.endpoint?.slug) {
    throw new Error(
      body.error ?? `merchant not registered for origin ${normalized}`,
    );
  }
  const ep = body.endpoint;
  const proxyBase = opts?.proxyBase ?? DEFAULT_MARKET_PROXY_URL;
  return {
    slug: ep.slug,
    hostname: ep.hostname,
    insuredUrl: insuredProxyUrl(ep.slug, "", proxyBase),
    apiPriceMicroUsdc: ep.api_price_micro_usdc?.toString(),
    flatPremiumMicroAlgos: ep.flat_premium_micro_algos?.toString(),
    paused: ep.paused,
  };
}

export async function insuredUrlForMerchant(
  merchantUrl: string,
  opts?: {
    indexerUrl?: string;
    proxyBase?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<string> {
  const { origin, path } = splitMerchantUrl(merchantUrl);
  const resolved = await resolveMerchant(origin, opts);
  const proxyBase = opts?.proxyBase ?? DEFAULT_MARKET_PROXY_URL;
  return insuredProxyUrl(resolved.slug, path, proxyBase);
}
