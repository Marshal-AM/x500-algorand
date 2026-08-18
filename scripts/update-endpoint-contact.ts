/**
 * Update an endpoint's on-chain contact (x402 payTo) + Supabase row.
 *
 * Env:
 *   X500_REGISTER_SLUG
 *   X500_REGISTER_HOSTNAME
 *   X500_REGISTER_CONTACT
 *   X500_REGISTER_API_PRICE_MICRO_USDC (default 10000)
 */
import { createClient } from "@supabase/supabase-js";
import {
  encodeSlug,
  encodeUpdateEndpoint,
} from "x500-protocol-algorand-v1-client";
import {
  deployments,
  requireEnv,
  submitAppCall,
} from "./lib/algorand.js";
import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";

async function main(): Promise<void> {
  const slug = requireEnv("X500_REGISTER_SLUG");
  const hostname = requireEnv("X500_REGISTER_HOSTNAME");
  const contact = requireEnv("X500_REGISTER_CONTACT");
  const apiPrice = BigInt(
    process.env.X500_REGISTER_API_PRICE_MICRO_USDC?.trim() || "10000",
  );

  const d = deployments();
  const txid = await submitAppCall({
    appId: d.registry.appId,
    appArgs: encodeUpdateEndpoint({
      slug,
      hostname,
      apiPriceMicroUsdc: apiPrice,
      contactAddress: contact,
    }),
    boxes: [{ appIndex: d.registry.appId, name: encodeSlug(slug) }],
  });
  console.log(`[ok] update_endpoint ${slug} contact=${contact} tx=${txid}`);

  const url = getAlgorandSupabaseUrl();
  const key = getAlgorandSupabaseServiceRoleKey();
  if (!url || !key) {
    console.warn("[warn] ALGORAND_SUPABASE_* missing — skip DB upsert");
    return;
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await sb
    .from("endpoints")
    .update({
      hostname,
      contact_address: contact,
      api_price_micro_usdc: Number(apiPrice),
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
  console.log("[ok] endpoints contact updated");
}

main().catch((err) => {
  console.error("[fail] update-endpoint-contact", err);
  process.exit(1);
});
