# x500-algorand

[![npm version](https://img.shields.io/npm/v/x500-algorand.svg)](https://www.npmjs.com/package/x500-algorand)
[![license](https://img.shields.io/npm/l/x500-algorand.svg)](https://github.com/Marshal-AM/x500/blob/main/packages/x500-algorand/LICENSE)

**Command-line tool for x500 — insured API calls and x402 Exact USDC payments on Algorand testnet.**

Wraps [`x500-agent-sdk`](https://www.npmjs.com/package/x500-agent-sdk) for quick testing, scripting, and CI. Merchant and insurance amounts are **microUSDC** (testnet ASA `10458941`). Agents also need **ALGO** for transaction fees.

**V1 scope:** `--network testnet` only.

| Live | URL |
|------|-----|
| Dashboard | [dashboard-production-915f.up.railway.app/endpoints](https://dashboard-production-915f.up.railway.app/endpoints) |
| Chat demo | [chat-production-acf6.up.railway.app](https://chat-production-acf6.up.railway.app/) |

---

## Install

```bash
npm install -g x500-algorand
```

Or run without installing:

```bash
npx x500-algorand --network testnet balance
```

Requires **Node.js 18+**.

---

## Setup

Export your Algorand testnet agent credentials (any funded testnet account with USDC ASA `10458941` opted in):

```bash
export X500_AGENT_ADDRESS=YOUR_ALGORAND_ADDRESS
export ALGORAND_AGENT_MNEMONIC="25 word recovery phrase ..."
```

Optional — override default Railway service URLs for local dev:

```bash
export MARKET_PROXY_URL=http://127.0.0.1:8788
export INDEXER_URL=http://127.0.0.1:8787
export FACILITATOR_URL=https://facilitator.goplausible.xyz
export X500_POOL_APP_ID=769443375
export X500_DEPLOYMENTS_PATH=./config/deployments.algorand.testnet.json
```

Check wallet USDC balance:

```bash
x500-algorand --network testnet balance
```

Fund insurance escrow (one-time `deposit_escrow` on `X500Pool`):

```bash
x500-algorand --network testnet approve
```

Deposits **3 USDC** (3,000,000 microUSDC) by default. Requires a grouped ASA transfer + app call; wallet must be opted into USDC ASA `10458941`.

---

## Commands

### Insured fetch (default)

Pass a URL as the first argument. Prints HTTP status and response body preview.

```bash
# Merchant origin URL — slug resolved via indexer
x500-algorand --network testnet https://your-merchant.example/paid/weather?city=Tokyo

# Explicit proxy path
x500-algorand --network testnet /v1/my-slug/paid/weather?city=Tokyo
```

Inspect `x-x500-*` response headers via the SDK or indexer `calls show` after the call.

### `balance`

Wallet **USDC** balance for `X500_AGENT_ADDRESS` (microUSDC).

```bash
x500-algorand --network testnet balance
```

```json
{
  "address": "LGRB…",
  "network": "algorand:testnet",
  "asset": "algo",
  "balanceMicroAlgos": "10165000"
}
```

> `balanceMicroAlgos` is the USDC balance in microUSDC from the indexer ASA read (legacy field name in CLI output).

### `approve` / `setup`

Deposit USDC escrow for insurance premiums (`X500Pool.deposit_escrow`).

```bash
x500-algorand --network testnet approve
```

```json
{
  "transactionId": "ABC123…",
  "loraUrl": "https://lora.algokit.io/testnet/transaction/ABC123…"
}
```

### `pay`

x402-only USDC payment — **no** insurance wrap. Useful for testing merchant x402 routes directly.

```bash
x500-algorand --network testnet pay https://merchant.example/paid/quote
```

### `calls show <callId>`

Fetch call detail from the indexer (settlement tx, outcome, premiums).

```bash
x500-algorand --network testnet calls show 01234567-89ab-cdef-0123-456789abcdef
```

### `agents show [address]`

Agent stats and escrow info. Defaults to your `X500_AGENT_ADDRESS`.

```bash
x500-algorand --network testnet agents show
x500-algorand --network testnet agents show YOUR_ALGORAND_ADDRESS
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `X500_AGENT_ADDRESS` | Yes | Algorand address (base32) |
| `ALGORAND_AGENT_MNEMONIC` | Yes | 25-word recovery phrase |
| `MARKET_PROXY_URL` | No | Insured gateway base URL |
| `PROXY_URL` | No | Alias for `MARKET_PROXY_URL` |
| `INDEXER_URL` | No | Indexer REST API base URL |
| `FACILITATOR_URL` | No | x402 facilitator URL (GoPlausible) |
| `X500_DEPLOYMENTS_PATH` | No | Path to `deployments.algorand.testnet.json` |
| `X500_POOL_APP_ID` | No | Pool app id for escrow (default `769443375`) |
| `ALGORAND_ALGOD_URL` | No | Algod for on-chain writes (default public testnet) |

When unset, URLs default to the live x500 Railway testnet stack.

---

## Typical workflow

```bash
# 1. Credentials
export X500_AGENT_ADDRESS=…
export ALGORAND_AGENT_MNEMONIC="…"

# 2. Check USDC balance
x500-algorand --network testnet balance

# 3. Deposit insurance escrow (USDC)
x500-algorand --network testnet approve

# 4. Call a registered merchant API
x500-algorand --network testnet https://your-origin.example/paid/weather?city=London

# 5. Inspect settlement
x500-algorand --network testnet calls show <callId-from-response-headers>
```

Merchants must register their public origin URL in the [x500 dashboard](https://dashboard-production-915f.up.railway.app/) (Pera / Defly) or indexer DB before insured calls succeed.

### SLA breach test (local)

```bash
pnpm example:server:slow   # 20s delay after x402 settle, SLA 15s in DB
x500-algorand --network testnet http://127.0.0.1:8801/paid/weather?city=London
```

Expect `latency_breach` and refund **15_000** microUSDC (0.015 USDC). Example refund tx: [PG7Y5X…](https://lora.algokit.io/testnet/transaction/PG7Y5XUUUXRIFT5K2A2CPUSTDXQG4S4WPVRULAKN326IXYBEZ2WA).

---

## Programmatic use

For agents, LangChain tools, and production integrations, use **[x500-agent-sdk](https://www.npmjs.com/package/x500-agent-sdk)** instead:

```bash
npm install x500-agent-sdk
```

---

## Links

- [x500-agent-sdk on npm](https://www.npmjs.com/package/x500-agent-sdk)
- [x500 monorepo & full docs](https://github.com/Marshal-AM/x500)
- [Live dashboard](https://dashboard-production-915f.up.railway.app/endpoints) · [Live chat demo](https://chat-production-acf6.up.railway.app/)
- [Example agent + merchant server](https://github.com/Marshal-AM/x500/tree/main/example)
- [Lora testnet explorer](https://lora.algokit.io/testnet)
- [Pool app](https://lora.algokit.io/testnet/application/769443375)

---

## License

MIT
