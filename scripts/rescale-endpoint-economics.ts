/**
 * Rescale endpoint economics in Supabase (tinybar-scale → microUSDC 6-decimal).
 */
import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";

async function main(): Promise<void> {
  const url = getAlgorandSupabaseUrl()?.replace(/\/$/, "");
  const key = getAlgorandSupabaseServiceRoleKey();
  if (!url || !key) throw new Error("ALGORAND_SUPABASE_* required");

  const patchBoth = await fetch(
    `${url}/rest/v1/endpoints?network=eq.algorand:testnet&flat_premium_micro_algos=eq.1000000&imputed_cost_micro_algos=gte.10000000`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({
        flat_premium_micro_algos: 10000,
        imputed_cost_micro_algos: 100000,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  console.log("patch legacy both", patchBoth.status, await patchBoth.text());

  const patchPremium = await fetch(
    `${url}/rest/v1/endpoints?network=eq.algorand:testnet&flat_premium_micro_algos=eq.1000000&imputed_cost_micro_algos=lt.10000000`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({
        flat_premium_micro_algos: 10000,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  console.log("patch legacy premium", patchPremium.status, await patchPremium.text());

  const patchLegacyImputed = await fetch(
    `${url}/rest/v1/endpoints?network=eq.algorand:testnet&imputed_cost_micro_algos=eq.10000000`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({
        imputed_cost_micro_algos: 100000,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  console.log(
    "patch legacy imputed only",
    patchLegacyImputed.status,
    await patchLegacyImputed.text(),
  );

  const patchImputedZero = await fetch(
    `${url}/rest/v1/endpoints?network=eq.algorand:testnet&imputed_cost_micro_algos=eq.0`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({
        imputed_cost_micro_algos: 100000,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  console.log("patch imputed zero", patchImputedZero.status, await patchImputedZero.text());

  const list = await fetch(
    `${url}/rest/v1/endpoints?network=eq.algorand:testnet&select=slug,flat_premium_micro_algos,imputed_cost_micro_algos,api_price_micro_usdc`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } },
  );
  console.log(await list.text());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
