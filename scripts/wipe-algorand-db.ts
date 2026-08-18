/**
 * Truncate x500 Algorand Supabase tables (service role).
 *
 * Order respects FKs: fee shares → calls → jobs → pool → settlements → agents → endpoints.
 */
import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";

const TABLES: Array<{ name: string; filter: string }> = [
  { name: "settlement_fee_shares", filter: "id=gte.0" },
  { name: "calls", filter: "call_id=not.is.null" },
  { name: "settle_jobs", filter: "id=not.is.null" },
  { name: "pool_state", filter: "endpoint_slug=not.is.null" },
  { name: "settlements", filter: "id=not.is.null" },
  { name: "agents", filter: "address=not.is.null" },
  { name: "endpoints", filter: "slug=not.is.null" },
];

async function restDelete(
  url: string,
  key: string,
  table: string,
  filter: string,
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      prefer: "return=minimal",
    },
  });
  return { status: res.status, body: await res.text() };
}

async function main(): Promise<void> {
  const url = getAlgorandSupabaseUrl()?.replace(/\/$/, "");
  const key = getAlgorandSupabaseServiceRoleKey();
  if (!url || !key) throw new Error("ALGORAND_SUPABASE_* required");

  for (const { name, filter } of TABLES) {
    const r = await restDelete(url, key, name, filter);
    console.log(`delete ${name} status=${r.status} ${r.body.slice(0, 160)}`);
    if (r.status >= 400) {
      throw new Error(`failed to wipe ${name}: ${r.status} ${r.body}`);
    }
  }
  console.log("wipe complete");
}

main().catch((err) => {
  console.error("[wipe-algorand-db]", err);
  process.exit(1);
});
