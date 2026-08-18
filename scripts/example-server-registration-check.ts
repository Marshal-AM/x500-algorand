import { DEFAULT_INDEXER_URL } from "x500-agent-sdk";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

async function main(): Promise<void> {
  const origin = requireEnv("X500_MERCHANT_ORIGIN").replace(/\/$/, "");
  const base = (process.env.INDEXER_URL?.trim() || DEFAULT_INDEXER_URL).replace(
    /\/$/,
    "",
  );
  const url = `${base}/api/endpoints/resolve?origin=${encodeURIComponent(origin)}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));

  if (!res.ok || body?.error || !body?.endpoint?.slug) {
    throw new Error(
      `Origin not registered: ${origin}. Register in the dashboard (Merchants → Register).`,
    );
  }

  console.log(
    `[check] registered slug=${body.endpoint.slug} apiPriceMicroUsdc=${body.endpoint.api_price_micro_usdc ?? "?"}`,
  );
}

main().catch((err) => {
  console.error("[check] fail", err);
  process.exit(1);
});
