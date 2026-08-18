/**
 * Requeue a single failed settle job by call_id.
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  getAlgorandSupabaseUrl,
  getAlgorandSupabaseServiceRoleKey,
} from "@x500/db-algorand";

const callId = process.argv[2];
if (!callId) {
  console.error("usage: requeue-settle-job.ts <call_id>");
  process.exit(1);
}

async function main(): Promise<void> {
  const client = createClient(
    getAlgorandSupabaseUrl(),
    getAlgorandSupabaseServiceRoleKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket as never },
    },
  );
  const { error } = await client
    .from("settle_jobs")
    .update({
      status: "pending",
      attempts: 0,
      locked_by: null,
      lease_expires_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("call_id", callId);
  if (error) throw new Error(error.message);
  console.log(`requeued ${callId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
