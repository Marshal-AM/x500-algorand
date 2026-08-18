# x500 Algorand Example E2E

End-to-end flow for insured API calls with x402 USDC payments on Algorand testnet.

## Prerequisites

- Funded testnet accounts: operator, settler, agent, merchant
- Agent opted into USDC testnet ASA `10458941`
- `ALGORAND_SUPABASE_*` for indexer/settler/proxy
- `NGROK_AUTHTOKEN` for public merchant URLs
- `GROQ_API_KEY` for the example agent
- Root `.env` from `.env.example`

## 1. Database

```bash
pnpm db:migrate
```

## 2. Compile and deploy protocol

```bash
pnpm protocol:compile
pnpm protocol:deploy
pnpm protocol:init
pnpm protocol:register
pnpm protocol:topup
```

Set `X500_POOL_APP_ID` and `X500_DEPLOYMENTS_PATH=./config/deployments.algorand.testnet.json` in root `.env`.

## 3. Platform services (root `.env`)

```bash
pnpm indexer:dev
pnpm settler:dev
pnpm proxy:dev
```

## 4. Fast merchant server

```bash
# example/server/.env — NGROK_AUTHTOKEN, SERVER_PORT=8800
pnpm example:server
```

Register ngrok origin in Supabase `endpoints` (or via `pnpm protocol:register` with `X500_REGISTER_HOSTNAME`).

## 5. Slow merchant (SLA breach demo)

```bash
# SERVER_PORT=8801
pnpm example:server:slow
```

Register second slug (e.g. `weather-slow`) with lower `sla_ms`.

## 6. Example agent

```bash
# example/agent/.env — agent mnemonic, MARKET_PROXY_URL, INDEXER_URL, GROQ_API_KEY
pnpm example:agent
```

Fund agent ALGO + USDC; run SDK `setup()` or `x500-algorand approve` for pool escrow.

## Verification

| Test | Expected |
|------|----------|
| Fast weather via agent | 200, USDC x402, Lora merchant payment tx |
| Insured proxy path | `x-x500-call-id`, premium headers, settler `settle_batch` on Lora |
| Slow server | `latency_breach`, refund > 0 |
| `pnpm algorand:x402-demo` | Direct x402 smoke against merchant URL |
