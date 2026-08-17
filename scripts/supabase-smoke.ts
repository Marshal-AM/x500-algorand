/**
 * Algorand Supabase connectivity smoke.
 */
import {
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";

async function main(): Promise<void> {
  const url = getAlgorandSupabaseUrl();
  const key = getAlgorandSupabaseServiceRoleKey();

  if (!url || !key) {
    console.error(
      "[fail] supabase-smoke: ALGORAND_SUPABASE_URL and ALGORAND_SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
    process.exit(1);
  }

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Supabase auth failed with status ${res.status}`);
  }
  if (!res.ok && res.status !== 404) {
    if (res.status < 200 || res.status >= 500) {
      throw new Error(`Supabase REST probe failed with status ${res.status}`);
    }
  }

  console.log(`[ok] supabase-smoke reached ${url} (status ${res.status})`);
}

main().catch((err) => {
  console.error("[fail] supabase-smoke", err);
  process.exit(1);
});
