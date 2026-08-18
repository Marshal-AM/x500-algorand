# x500-agent-sdk

**Parametric micro-insurance for AI agent API payments on Algorand testnet.**

`x500-agent-sdk` wraps `fetch` so agents can call merchant APIs through the x500 insured gateway: pay the merchant via **x402 USDC** (GoPlausible facilitator), pay a flat insurance premium from **ALGO escrow**, and receive parametric refunds when calls fail or breach SLA.

**V1 scope:** Algorand testnet only · USDC merchant payments · ALGO insurance escrow · no mainnet.

---

## Install

```bash
npm install x500-agent-sdk
```

Requires **Node.js 18+** (native `fetch`).

---

## Quick start

```ts
import { createX500 } from "x500-agent-sdk";

const x500 = createX500({
  network: "testnet",
  address: process.env.X500_AGENT_ADDRESS!,       // Algorand address
  mnemonic: process.env.ALGORAND_AGENT_MNEMONIC!, // 25-word phrase
});

// 1. Fund insurance escrow once (microAlgos)
await x500.setup({ escrowMicroAlgos: 3_000_000n }); // 3 ALGO default

// 2. Call a registered merchant by origin URL — slug resolved automatically
const res = await x500.fetch(
  "https://your-merchant.example/paid/weather?city=Paris",
);

console.log(res.status, await res.text());
await x500.close();
```

The merchant origin must be registered in the x500 dashboard. You do **not** need the slug or proxy URL upfront.

---

## How it works

```
Agent (SDK)  →  Market proxy (/v1/{slug}/…)  →  Merchant x402 API
                    ↓                                    ↓
              Classify outcome                    USDC via facilitator
              settle premium / refund on Algorand (ALGO escrow)
```

| Payment rail | What happens |
|--------------|----------------|
| **Merchant API** | x402 USDC payment during the HTTP call (facilitator: `facilitator.goplausible.xyz`) |
| **Insurance** | Premium debited from agent ALGO escrow → pool via `settleBatch` |
| **Refund** | Parametric refund from pool → agent on covered failures / SLA breach |

The SDK adds `x-x500-agent-address` on insured requests and parses response headers (`X-X500-Call-Id`, `X-X500-Premium`, `X-X500-Refund`, `X-X500-Outcome`).

---

## Configuration

### Required

| Variable / option | Description |
|-------------------|-------------|
| `network` | Must be `"testnet"` in V1 |
| `address` | Algorand agent address (base32) |
| `mnemonic` | 25-word recovery phrase |

### Optional overrides

| Option | Env var | Default |
|--------|---------|---------|
| `proxyUrl` | `MARKET_PROXY_URL` or `PROXY_URL` | `http://127.0.0.1:8788` |
| `indexerUrl` | `INDEXER_URL` | `http://127.0.0.1:8787` |
| `facilitatorUrl` | `FACILITATOR_URL` | `https://facilitator.goplausible.xyz` |
| `poolAppId` | `X500_POOL_APP_ID` | from deployments |
| `deploymentsPath` | `X500_DEPLOYMENTS_PATH` | `config/deployments.algorand.testnet.json` |

---

## API reference

### `createX500(options)` → `X500Client`

Factory for the agent client. Throws if `network !== "testnet"`.

### HTTP methods

| Method | Description |
|--------|-------------|
| **`fetch(url, init?)`** | Insured fetch — drop-in replacement for `fetch`. Merchant origin URLs auto-resolve to the proxy. Handles x402 402 → pay → retry. |
| **`pay(url, init?)`** | x402-only — no insurance wrap. Direct merchant USDC payment. |

### Merchant resolution

| Method | Description |
|--------|-------------|
| **`resolveMerchant(origin)`** | `GET /api/endpoints/resolve` — returns `{ slug, hostname, insuredUrl, apiPriceMicroUsdc, flatPremiumMicroAlgos }`. |

**Exported helpers:** `insuredUrlForMerchant`, `normalizeMerchantOrigin`, `insuredProxyUrl`.

### Escrow & balance

| Method | Description |
|--------|-------------|
| **`setup({ escrowMicroAlgos? })`** | `depositEscrow` on `X500Pool`. Default **3,000,000 microAlgos** (3 ALGO). Returns `{ transactionId, loraUrl }`. |
| **`topUp(microAlgos)`** | Additional escrow deposit. |
| **`getBalance()`** | Agent wallet ALGO balance in microAlgos. |

### Indexer reads

| Method | Description |
|--------|-------------|
| **`getCall(callId)`** | `GET /api/calls/:id` — settlement status, outcome, tx id. |
| **`getAgent(address?)`** | `GET /api/agents/:address` — escrow stats and call history. |

### Events

```ts
x500.on("billed", (e) => {
  console.log(`Premium ${e.premiumMicroAlgos} microAlgos — call ${e.callId}`);
});

x500.on("refund", (e) => {
  console.log(`Refund ${e.refundMicroAlgos} microAlgos — call ${e.callId}`);
});

x500.on("failure", (e) => {
  console.log(`Failed: ${e.outcome} HTTP ${e.status}`);
});

x500.on("degraded", (e) => {
  console.log(`Settlement pending — call ${e.callId}`);
});
```

### Lifecycle

| Method | Description |
|--------|-------------|
| **`close()`** | Release resources. Call when done. |

---

## Response headers

| Header | Meaning |
|--------|---------|
| `X-X500-Call-Id` | Unique call id (maps to on-chain settlement) |
| `X-X500-Outcome` | `ok`, `latency_breach`, `server_error`, `network_error`, `client_error`, … |
| `X-X500-Premium` | Insurance premium (microAlgos) |
| `X-X500-Refund` | Refund (microAlgos), `0` if none |
| `X-X500-Network` | `algorand:testnet` |
| `X-X500-Asset` | USDC ASA id for merchant layer; `algo` for insurance |
| `X-X500-Settlement-Pending` | `1` if on-chain settle not yet confirmed |

View transactions on [Lora](https://lora.algokit.io/testnet).

---

## Prerequisites

1. **Algorand testnet account** with ALGO ([faucet](https://bank.testnet.algorand.network/)).
2. **Insurance escrow** — `setup()` or `x500-algorand approve` once.
3. **Registered merchant** — register public origin URL in the x500 dashboard (Pera / Defly).

---

## CLI

Prefer a terminal? Use companion package **[x500-algorand](https://www.npmjs.com/package/x500-algorand)**:

```bash
npm install -g x500-algorand
x500-algorand --network testnet balance
x500-algorand --network testnet approve
x500-algorand --network testnet https://merchant.example/paid/weather?city=Tokyo
```

---

## Constants

```ts
import {
  USDC_TESTNET_ASA_ID,   // "10458941"
  ALGORAND_TESTNET,       // "algorand:testnet"
  DEFAULT_MARKET_PROXY_URL,
  DEFAULT_INDEXER_URL,
  DEFAULT_FACILITATOR_URL,
} from "x500-agent-sdk";
```

---

## License

MIT
