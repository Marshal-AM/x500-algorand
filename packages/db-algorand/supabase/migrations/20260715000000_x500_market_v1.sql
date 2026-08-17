-- x500 Phase 3 schema: Algorand testnet only

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS endpoints (
  slug TEXT PRIMARY KEY,
  network TEXT NOT NULL DEFAULT 'algorand:testnet',
  hostname TEXT NOT NULL,
  sla_ms INTEGER NOT NULL,
  flat_premium_micro_algos BIGINT NOT NULL,
  imputed_cost_micro_algos BIGINT NOT NULL DEFAULT 0,
  percent_bps INTEGER NOT NULL DEFAULT 0,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  pool_balance_micro_algos BIGINT NOT NULL DEFAULT 0,
  api_price_micro_usdc BIGINT NOT NULL DEFAULT 5000,
  contact_address TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT endpoints_network_check CHECK (network = 'algorand:testnet')
);

CREATE TABLE IF NOT EXISTS agents (
  address TEXT PRIMARY KEY,
  total_premiums_micro_algos BIGINT NOT NULL DEFAULT 0,
  total_refunds_micro_algos BIGINT NOT NULL DEFAULT 0,
  call_count BIGINT NOT NULL DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
  call_id TEXT PRIMARY KEY,
  agent_address TEXT NOT NULL REFERENCES agents(address),
  endpoint_slug TEXT NOT NULL REFERENCES endpoints(slug),
  outcome TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  premium_micro_algos BIGINT NOT NULL,
  refund_micro_algos BIGINT NOT NULL DEFAULT 0,
  breach BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'settled',
  network TEXT NOT NULL DEFAULT 'algorand:testnet',
  asset TEXT NOT NULL DEFAULT 'algo',
  settlement_tx_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calls_network_check CHECK (network = 'algorand:testnet'),
  CONSTRAINT calls_asset_check CHECK (asset IN ('10458941', 'algo'))
);

CREATE INDEX IF NOT EXISTS calls_agent_idx ON calls(agent_address);
CREATE INDEX IF NOT EXISTS calls_endpoint_idx ON calls(endpoint_slug);
CREATE INDEX IF NOT EXISTS calls_created_idx ON calls(created_at DESC);

CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id TEXT NOT NULL UNIQUE,
  consensus_timestamp TEXT,
  network TEXT NOT NULL DEFAULT 'algorand:testnet',
  asset TEXT NOT NULL DEFAULT 'algo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT settlements_network_check CHECK (network = 'algorand:testnet'),
  CONSTRAINT settlements_asset_check CHECK (asset IN ('10458941', 'algo'))
);

CREATE TABLE IF NOT EXISTS settlement_fee_shares (
  id BIGSERIAL PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  recipient_address TEXT NOT NULL,
  amount_micro_algos BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS settle_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'leased', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  leased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS settle_jobs_status_idx ON settle_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS pool_state (
  endpoint_slug TEXT PRIMARY KEY REFERENCES endpoints(slug),
  balance_micro_algos BIGINT NOT NULL DEFAULT 0,
  escrow_micro_algos BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
