/**
 * Requeue failed settle_jobs (e.g. after deployments were fixed).
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
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });

  const { data, error } = await client
    .from("settle_jobs")
    .select("id, call_id, last_error")
    .eq("status", "failed");

  if (error) throw new Error(error.message);
  if (!data?.length) {
    console.log("no failed settle_jobs");
    return;
  }

  for (const row of data) {
    const { error: updErr } = await client
      .from("settle_jobs")
      .update({
        status: "pending",
        attempts: 0,
        locked_by: null,
        lease_expires_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updErr) throw new Error(updErr.message);
    console.log(`requeued ${row.call_id} (${row.last_error?.slice(0, 60) ?? ""})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
