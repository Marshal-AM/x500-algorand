import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";

async function main(): Promise<void> {
  const url = getAlgorandSupabaseUrl();
  const key = getAlgorandSupabaseServiceRoleKey();
  const slug = process.env.INSPECT_SLUG?.trim() ?? "agenttest";
  if (!url || !key) {
    throw new Error("ALGORAND_SUPABASE_URL + ALGORAND_SUPABASE_SERVICE_ROLE_KEY required");
  }
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/endpoints?slug=eq.${encodeURIComponent(slug)}&select=slug,hostname,sla_ms,flat_premium_micro_algos,imputed_cost_micro_algos,api_price_micro_usdc,paused,contact_address`;
  const res = await fetch(endpoint, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  console.log(`status=${res.status}`);
  console.log(body);
}

main().catch((err) => {
  console.error("[inspect-endpoint] failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
