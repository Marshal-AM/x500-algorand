import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";

async function main(): Promise<void> {
  const url = getAlgorandSupabaseUrl();
  const key = getAlgorandSupabaseServiceRoleKey();
  const slug = process.env.SLA_SLUG?.trim() ?? "agenttest";
  const slaMs = Number(process.env.SLA_MS?.trim() ?? "60000");
  if (!url || !key) {
    throw new Error("ALGORAND_SUPABASE_URL + ALGORAND_SUPABASE_SERVICE_ROLE_KEY required");
  }
  if (!Number.isFinite(slaMs) || slaMs <= 0) {
    throw new Error("SLA_MS must be a positive number of milliseconds");
  }
  const hostname = process.env.SLA_HOSTNAME?.trim();
  const patch: Record<string, unknown> = { sla_ms: slaMs };
  if (hostname) patch.hostname = hostname;
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/endpoints?slug=eq.${encodeURIComponent(slug)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });
  const body = await res.text();
  console.log(`status=${res.status}`);
  console.log(body);
}

main().catch((err) => {
  console.error("[set-endpoint-sla] failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
