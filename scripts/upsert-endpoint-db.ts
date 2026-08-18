/**
 * Upsert endpoint row in Supabase only (no on-chain tx).
 */
import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";
import {
  DEFAULT_FLAT_PREMIUM_MICRO_USDC,
  DEFAULT_IMPUTED_COST_MICRO_USDC,
} from "../packages/wrap/src/economicsDefaults.ts";
import { normalizeOriginUrl } from "./lib/normalize-origin.js";

async function main(): Promise<void> {
  const url = getAlgorandSupabaseUrl()?.replace(/\/$/, "");
  const key = getAlgorandSupabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error("ALGORAND_SUPABASE_URL and SERVICE_ROLE_KEY required");
  }

  const slug = process.env.X500_REGISTER_SLUG?.trim() || "pay-default";
  const hostname = normalizeOriginUrl(
    process.env.X500_REGISTER_HOSTNAME?.trim() ||
      process.env.X500_MERCHANT_ORIGIN?.trim() ||
      `http://127.0.0.1:${process.env.SERVER_PORT?.trim() || "8800"}`,
  );
  const contact =
    process.env.X500_REGISTER_CONTACT?.trim() ||
    process.env.ALGORAND_MERCHANT_ADDRESS?.trim();
  if (!contact) throw new Error("ALGORAND_MERCHANT_ADDRESS required");

  const row = {
    slug,
    network: "algorand:testnet",
    hostname,
    sla_ms: Number(process.env.X500_REGISTER_SLA_MS ?? "60000"),
    flat_premium_micro_algos: Number(
      process.env.X500_REGISTER_PREMIUM_MICRO_ALGOS ??
        String(DEFAULT_FLAT_PREMIUM_MICRO_USDC),
    ),
    imputed_cost_micro_algos: Number(
      process.env.X500_REGISTER_IMPUTED_MICRO_ALGOS ??
        String(DEFAULT_IMPUTED_COST_MICRO_USDC),
    ),
    api_price_micro_usdc: Number(
      process.env.X500_REGISTER_API_PRICE_MICRO_USDC ?? "5000",
    ),
    contact_address: contact,
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(`${url}/rest/v1/endpoints`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`endpoints upsert ${res.status}: ${body}`);
  }

  console.log("[ok] endpoints upsert", JSON.parse(body));
}

main().catch((err) => {
  console.error("[fail] upsert-endpoint-db", err);
  process.exit(1);
});
