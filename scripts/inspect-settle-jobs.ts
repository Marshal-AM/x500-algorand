/**
 * Inspect settle_jobs queue in Supabase.
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  getAlgorandSupabaseUrl,
  getAlgorandSupabaseServiceRoleKey,
} from "@x500/db-algorand";

async function main(): Promise<void> {
  const url = getAlgorandSupabaseUrl();
  const key = getAlgorandSupabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error("ALGORAND_SUPABASE_URL + service role key required");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });

  const { data, error } = await client
    .from("settle_jobs")
    .select("id, call_id, status, attempts, last_error, locked_by, lease_expires_at, created_at, updated_at, payload")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  console.log(`settle_jobs count (latest 20): ${data?.length ?? 0}`);
  for (const row of data ?? []) {
    const payload = row.payload as Record<string, unknown> | null;
    console.log("---");
    console.log(`call_id=${row.call_id}`);
    console.log(`status=${row.status} attempts=${row.attempts}`);
    console.log(`locked_by=${row.locked_by ?? "—"} lease=${row.lease_expires_at ?? "—"}`);
    console.log(`last_error=${row.last_error ?? "—"}`);
    console.log(
      `premium=${payload?.premiumMicroAlgos} refund=${payload?.refundMicroAlgos} outcome=${payload?.outcome} slug=${payload?.endpointSlug}`,
    );
    console.log(`created=${row.created_at} updated=${row.updated_at}`);
  }

  const statuses = ["pending", "leased", "done", "failed"] as const;
  for (const s of statuses) {
    const { count } = await client
      .from("settle_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", s);
    console.log(`status ${s}: ${count ?? 0}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
