/**
 * Apply SQL migrations in packages/db-algorand/supabase/migrations.
 *
 * Uses ALGORAND_SUPABASE_DB_URL for the Algorand Supabase project.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import {
  getAlgorandSupabaseDbUrl,
  getAlgorandSupabaseServiceRoleKey,
  getAlgorandSupabaseUrl,
} from "@x500/db-algorand";

const REQUIRED_TABLES = [
  "endpoints",
  "agents",
  "calls",
  "settlements",
  "settlement_fee_shares",
  "settle_jobs",
  "pool_state",
] as const;

async function tablesExistViaRest(): Promise<boolean> {
  const url = getAlgorandSupabaseUrl()?.replace(/\/$/, "");
  const key = getAlgorandSupabaseServiceRoleKey();
  if (!url || !key) return false;

  for (const table of REQUIRED_TABLES) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.status !== 200) {
      const body = await res.text();
      console.error(`[probe] ${table} → ${res.status} ${body.slice(0, 120)}`);
      return false;
    }
  }
  return true;
}

async function leaseSchemaReadyViaRest(): Promise<boolean> {
  const url = getAlgorandSupabaseUrl()?.replace(/\/$/, "");
  const key = getAlgorandSupabaseServiceRoleKey();
  if (!url || !key) return false;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const col = await fetch(
    `${url}/rest/v1/settle_jobs?select=call_id,lease_expires_at,locked_by,last_error&limit=1`,
    { headers },
  );
  if (col.status !== 200) {
    const body = await col.text();
    console.error(
      `[probe] settle_jobs lease columns → ${col.status} ${body.slice(0, 160)}`,
    );
    return false;
  }

  const rpc = await fetch(`${url}/rest/v1/rpc/claim_settle_jobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_limit: 0,
      p_worker: "migrate-probe",
      p_lease_seconds: 1,
    }),
  });
  if (rpc.status !== 200) {
    const body = await rpc.text();
    console.error(
      `[probe] claim_settle_jobs → ${rpc.status} ${body.slice(0, 160)}`,
    );
    return false;
  }
  return true;
}

async function applyViaPg(dbUrl: string): Promise<void> {
  const dir = join(
    process.cwd(),
    "packages",
    "db-algorand",
    "supabase",
    "migrations",
  );
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error(`No .sql migrations in ${dir}`);
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _x500_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const file of files) {
      const { rows } = await client.query(
        `SELECT 1 FROM _x500_migrations WHERE id = $1`,
        [file],
      );
      if (rows.length > 0) {
        console.log(`[skip] ${file} already applied`);
        continue;
      }
      const sql = readFileSync(join(dir, file), "utf8");
      console.log(`[apply] ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO _x500_migrations (id) VALUES ($1)`, [
          file,
        ]);
        await client.query("COMMIT");
        console.log(`[ok] ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("[ok] db:migrate complete (pg)");
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const raw = getAlgorandSupabaseDbUrl() ?? "";
  const dbUrl =
    raw.startsWith("postgres://") || raw.startsWith("postgresql://")
      ? raw
      : "";

  if (raw && !dbUrl) {
    console.warn(
      `[warn] ALGORAND_SUPABASE_DB_URL is not a Postgres URI (got "${raw.slice(0, 40)}…"). ` +
        "Ignoring — use postgresql://… from Settings → Database (prefer Session pooler).",
    );
  }

  if (dbUrl) {
    try {
      await applyViaPg(dbUrl);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[warn] pg migrate failed (${msg}). Falling back to REST schema probe.`,
      );
    }
  }

  console.log(
    "[info] Checking schema via ALGORAND_SUPABASE_URL + SERVICE_ROLE",
  );
  const tablesOk = await tablesExistViaRest();
  if (!tablesOk) {
    console.error(
      "[fail] Algorand schema missing and Postgres migrate unavailable.\n" +
        "  Create a Supabase project for Algorand and set ALGORAND_SUPABASE_*.\n" +
        "  Apply packages/db-algorand/supabase/migrations/*.sql via Session pooler or SQL Editor.",
    );
    process.exit(1);
  }

  const leaseOk = await leaseSchemaReadyViaRest();
  if (!leaseOk) {
    console.error(
      "[fail] Phase 3 tables exist but settle_jobs lease schema is missing.\n" +
        "  Apply packages/db-algorand/supabase/migrations/20260715120000_settle_jobs_lease_v1.sql",
    );
    process.exit(1);
  }

  console.log(
    "[ok] db:migrate — Algorand tables + lease schema present (REST probe). DDL skipped.",
  );
}

main().catch((err) => {
  console.error("[fail] apply-migrations", err);
  process.exit(1);
});
