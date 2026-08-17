# x500-algorand

**Command-line tool for x500 — insured API calls and x402 USDC payments on Algorand testnet.**

Wraps [`x500-sdk-algorand`](https://www.npmjs.com/package/x500-sdk-algorand) for quick testing, scripting, and CI. Merchant amounts are **microUSDC**; insurance escrow uses **microAlgos**.

**V1 scope:** `--network testnet` only.

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

Export your Algorand testnet agent credentials:

```bash
export X500_AGENT_ADDRESS=YOUR_ADDRESS
export ALGORAND_AGENT_MNEMONIC="25 word recovery phrase ..."
```

Optional — override service URLs for local dev:

```bash
export MARKET_PROXY_URL=http://127.0.0.1:8788
export INDEXER_URL=http://127.0.0.1:8787
export FACILITATOR_URL=https://facilitator.goplausible.xyz
```

Check wallet balance:

```bash
x500-algorand --network testnet balance
```

Fund insurance escrow (one-time `depositEscrow` on `X500Pool`):

```bash
x500-algorand --network testnet approve
```

Deposits **3 ALGO** (3,000,000 microAlgos) by default.

---

## Commands

### Insured fetch (default)

Pass a URL as the first argument.

```bash
# Merchant origin URL — slug resolved via indexer
x500-algorand --network testnet https://your-merchant.example/paid/weather?city=Tokyo

# Explicit proxy path
x500-algorand --network testnet /v1/my-slug/paid/weather?city=Tokyo
```

### `balance`

Wallet ALGO balance for `X500_AGENT_ADDRESS`.

```bash
x500-algorand --network testnet balance
```

```json
{
  "address": "…",
  "network": "algorand:testnet",
  "asset": "algo",
  "balanceMicroAlgos": "5000000"
}
```

### `approve` / `setup`

Deposit ALGO escrow for insurance premiums (`X500Pool.depositEscrow`).

```bash
x500-algorand --network testnet approve
```

```json
{
  "transactionId": "…",
  "loraUrl": "https://lora.algokit.io/testnet/transaction/…"
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
x500-algorand --network testnet agents show YOUR_ADDRESS
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `X500_AGENT_ADDRESS` | Yes | Algorand address |
| `ALGORAND_AGENT_MNEMONIC` | Yes | 25-word recovery phrase |
| `MARKET_PROXY_URL` | No | Insured gateway base URL |
| `PROXY_URL` | No | Alias for `MARKET_PROXY_URL` |
| `INDEXER_URL` | No | Indexer REST API base URL |
| `FACILITATOR_URL` | No | x402 facilitator (`facilitator.goplausible.xyz`) |
| `X500_DEPLOYMENTS_PATH` | No | Path to `deployments.algorand.testnet.json` |
| `X500_POOL_APP_ID` | No | Pool app id for escrow |

---

## Typical workflow

```bash
# 1. Credentials
export X500_AGENT_ADDRESS=…
export ALGORAND_AGENT_MNEMONIC="…"

# 2. Check funds
x500-algorand --network testnet balance

# 3. Deposit insurance escrow
x500-algorand --network testnet approve

# 4. Call a registered merchant API
x500-algorand --network testnet https://your-ngrok-url.ngrok-free.app/paid/weather?city=London

# 5. Inspect settlement on Lora
x500-algorand --network testnet calls show <callId>
```

Merchants must register their public origin URL in the x500 dashboard (Pera / Defly) before insured calls succeed.

---

## Programmatic use

For agents, LangChain tools, and production integrations, use **[x500-sdk-algorand](https://www.npmjs.com/package/x500-sdk-algorand)**:

```bash
npm install x500-sdk-algorand
```

---

## License

MIT
