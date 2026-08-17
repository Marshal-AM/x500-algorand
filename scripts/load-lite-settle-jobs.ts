/**
 * Bounded load-lite: insert N pending settle_jobs and assert no duplicate call_id rows.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
  insertSettleJob,
} from "@x500/db-algorand";

const N = Math.min(Number(process.env.LOAD_LITE_N ?? 10), 50);

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main(): Promise<void> {
  const url = getAlgorandSupabaseUrl() ?? requireEnv("ALGORAND_SUPABASE_URL");
  const key =
    getAlgorandSupabaseServiceRoleKey() ??
    requireEnv("ALGORAND_SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });

  const callId = randomUUID();
  const payload = {
    callId,
    agentAddress: requireEnv("X500_AGENT_ADDRESS"),
    endpointSlug: "dummy",
    premiumMicroAlgos: "1000000",
    refundMicroAlgos: "0",
    latencyMs: 10,
    outcome: "ok",
    ts: new Date().toISOString(),
    network: "algorand:testnet",
    asset: "algo",
  };

  await insertSettleJob(sb, { callId, payload });
  let dupRejected = false;
  try {
    await insertSettleJob(sb, { callId, payload });
  } catch {
    dupRejected = true;
  }
  if (!dupRejected) {
    const { count } = await sb
      .from("settle_jobs")
      .select("*", { count: "exact", head: true })
      .eq("call_id", callId);
    if ((count ?? 0) > 1) {
      throw new Error(`duplicate settle_jobs for call_id ${callId}`);
    }
    console.log("[warn] duplicate insert did not throw — count check passed");
  } else {
    console.log("[ok] duplicate call_id insert rejected");
  }

  for (let i = 0; i < N; i++) {
    const id = randomUUID();
    await insertSettleJob(sb, {
      callId: id,
      payload: { ...payload, callId: id },
    });
  }
  console.log(`[ok] inserted ${N} bounded settle_jobs`);
}

main().catch((err) => {
  console.error("[fail] load-lite-settle-jobs", err);
  process.exit(1);
});
