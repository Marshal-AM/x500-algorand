import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  getAlgorandSupabaseUrl,
  getAlgorandSupabaseServiceRoleKey,
} from "@x500/db-algorand";

const callId = process.argv[2] ?? "5222700c-ffeb-45ca-85e5-5eb7f8e13a18";

async function main(): Promise<void> {
  const client = createClient(
    getAlgorandSupabaseUrl(),
    getAlgorandSupabaseServiceRoleKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket as never },
    },
  );
  const { data, error } = await client
    .from("settle_jobs")
    .select("payload, status, last_error")
    .eq("call_id", callId)
    .single();
  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
