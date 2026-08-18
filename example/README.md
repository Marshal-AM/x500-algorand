# x500 examples (Algorand)

End-to-end demo: merchant weather API + LangChain agent with **x500-agent-sdk** on Algorand testnet.

- Merchant payments: **USDC** via x402 (GoPlausible facilitator)
- Insurance: **USDC** escrow via `x500-agent-sdk` (ASA `10458941`)

## One-time setup

From the monorepo root (with root `.env` configured):

```bash
pnpm example:setup
```

This syncs `example/agent/.env` and `example/server/.env`, registers the local merchant (`pay-default` @ `http://127.0.0.1:8800`), and prints next steps.

**Agent wallet needs:**

- Testnet **USDC** ASA `10458941` opted in (x402 merchant payments + insurance escrow/refunds)
- Pool escrow: `X500_EXAMPLE_SETUP_ESCROW=1 pnpm example:setup` or `npx x500-algorand approve`

## Run the stack

```bash
# Terminal 1–3 — platform (root .env)
pnpm indexer:dev
pnpm settler:dev
pnpm proxy:dev

# Terminal 4 — example merchant (local, no ngrok required)
pnpm example:server

# Terminal 5 — smoke test (no Groq key)
pnpm example:agent:smoke

# Or interactive LangChain agent (needs GROQ_API_KEY in root .env)
pnpm example:agent
```

Local mode uses `EXAMPLE_LOCAL=1` and `http://127.0.0.1:8800` as the merchant origin.

For public ngrok URLs, set `NGROK_AUTHTOKEN` in root `.env` and remove `EXAMPLE_LOCAL=1` from `example/server/.env`.

## Packages

Examples install the **published** npm package (not workspace link):

```json
"x500-agent-sdk": "^0.1.0"
```

See `example/agent/.npmrc` and `example/server/.npmrc` (`link-workspace-packages=false`).

## Sub-projects

- [`server/README.md`](server/README.md) — x402 weather merchant
- [`agent/README.md`](agent/README.md) — LangChain + `x500-agent-sdk`
