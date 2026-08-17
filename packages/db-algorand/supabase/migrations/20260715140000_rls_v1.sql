-- Phase 8/9: minimal RLS — deny anon access to sensitive tables.
-- Service-role (backend services) bypasses RLS in Supabase.

ALTER TABLE IF EXISTS settle_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pool_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_settle_jobs'
  ) THEN
    CREATE POLICY deny_anon_settle_jobs ON settle_jobs
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_agents'
  ) THEN
    CREATE POLICY deny_anon_agents ON agents
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_calls'
  ) THEN
    CREATE POLICY deny_anon_calls ON calls
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'deny_anon_pool_state'
  ) THEN
    CREATE POLICY deny_anon_pool_state ON pool_state
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
END $$;
