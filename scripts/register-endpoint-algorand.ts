/**
 * Register an endpoint on-chain (registry app) + upsert Supabase row.
 *
 * Env:
 *   X500_REGISTER_SLUG (default pay-default)
 *   X500_REGISTER_HOSTNAME
 *   X500_REGISTER_API_PRICE_MICRO_USDC (default 5000)
 *   X500_REGISTER_CONTACT — Algorand merchant address (payTo)
 */
import { createClient } from "@supabase/supabase-js";
import algosdk from "algosdk";
import {
  encodeRegisterEndpoint,
  encodeSlug,
} from "@x500/protocol-algorand-v1-client";
import {
  algodClient,
  deployments,
  operatorAccount,
  requireEnv,
  submitAppCall,
} from "./lib/algorand.js";
import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";

async function main(): Promise<void> {
  const slug = process.env.X500_REGISTER_SLUG?.trim() || "pay-default";
  const hostname =
    process.env.X500_REGISTER_HOSTNAME?.trim() ||
    process.env.X500_MERCHANT_ORIGIN?.trim()?.replace(/^https?:\/\//, "") ||
    "localhost";
  const apiPrice = BigInt(
    process.env.X500_REGISTER_API_PRICE_MICRO_USDC?.trim() || "5000",
  );
  const contact = requireEnv(
    process.env.X500_REGISTER_CONTACT ? "X500_REGISTER_CONTACT" : "ALGORAND_MERCHANT_ADDRESS",
  );

  const d = deployments();
  const txid = await submitAppCall({
    appId: d.registry.appId,
    appArgs: [
      encodeRegisterEndpoint({
        slug,
        hostname,
        apiPriceMicroUsdc: apiPrice,
        contactAddress: contact,
        slaLatencyMs: Number(process.env.X500_REGISTER_SLA_MS ?? "60000"),
      }),
    ],
    boxes: [
      {
        appIndex: d.registry.appId,
        name: encodeSlug(slug),
      },
    ],
  });
  console.log(`[ok] register_endpoint ${slug} tx=${txid}`);

  const url = getAlgorandSupabaseUrl();
  const key = getAlgorandSupabaseServiceRoleKey();
  if (url && key) {
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await sb.from("endpoints").upsert(
      {
        slug,
        network: "algorand:testnet",
        hostname,
        sla_ms: Number(process.env.X500_REGISTER_SLA_MS ?? "60000"),
        flat_premium_micro_algos: Number(
          process.env.X500_REGISTER_PREMIUM_MICRO_ALGOS ?? "1000000",
        ),
        imputed_cost_micro_algos: Number(
          process.env.X500_REGISTER_IMPUTED_MICRO_ALGOS ?? "10000000",
        ),
        api_price_micro_usdc: Number(apiPrice),
        contact_address: contact,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );
    console.log("[ok] endpoints upsert (Algorand Supabase)");
  } else {
    console.warn("[warn] ALGORAND_SUPABASE_* missing — skip DB upsert");
  }
}

main().catch((err) => {
  console.error("[fail] register-endpoint-algorand", err);
  process.exit(1);
});
