# x500-agent-sdk

[![npm version](https://img.shields.io/npm/v/x500-agent-sdk.svg)](https://www.npmjs.com/package/x500-agent-sdk)
[![license](https://img.shields.io/npm/l/x500-agent-sdk.svg)](https://github.com/Marshal-AM/x500/blob/main/packages/x500-sdk-algorand/LICENSE)

**Parametric micro-insurance for AI agent API payments on Algorand testnet.**

`x500-agent-sdk` wraps `fetch` so agents can call merchant APIs through the x500 insured gateway: pay the merchant via **x402 Exact AVM (USDC)**, pay a flat insurance premium from on-chain **USDC escrow**, and receive parametric refunds when calls fail or breach SLA.

**V1 scope:** Algorand testnet only · testnet USDC ASA `10458941` · no mainnet.

| Live | URL |
|------|-----|
| Dashboard | [dashboard-production-915f.up.railway.app/endpoints](https://dashboard-production-915f.up.railway.app/endpoints) |
| Chat demo | [chat-production-acf6.up.railway.app](https://chat-production-acf6.up.railway.app/) |

---

## Install

```bash
npm install x500-agent-sdk
```

Requires **Node.js 18+** (uses native `fetch`).

---

## Quick start

```ts
import { createX500 } from "x500-agent-sdk";

const x500 = createX500({
  network: "testnet",
  address: process.env.X500_AGENT_ADDRESS!,       // Algorand address (base32)
  mnemonic: process.env.ALGORAND_AGENT_MNEMONIC!, // 25-word phrase
});

// 1. Fund insurance escrow once (microUSDC)
await x500.setup({ escrowMicroAlgos: 1_000_000n }); // 1 USDC default param = 3_000_000

// 2. Call a registered merchant by origin URL — slug resolved automatically
const res = await x500.fetch(
  "https://your-merchant.example/paid/weather?city=Paris",
);

console.log(res.status, await res.text());
await x500.close();
```

The merchant origin must be registered in the [x500 dashboard](https://dashboard-production-915f.up.railway.app/) (Pera / Defly) or indexer DB. You do **not** need to know the slug or proxy URL upfront.

---

## How it works

```
Agent (SDK)  →  Market proxy (/v1/{slug}/…)  →  Merchant x402 API
                    ↓                                    ↓
              Classify outcome                    USDC via GoPlausible
              settle premium / refund on Algorand (USDC escrow + pool)
```

| Payment rail | What happens |
|--------------|----------------|
| **Merchant API** | x402 USDC ASA transfer — agent pays merchant during the HTTP call |
| **Insurance** | Premium debited from agent USDC escrow → pool via `settle_batch` |
| **Refund** | Parametric USDC refund from pool → agent on covered failures / SLA breach |

The SDK adds `x-x500-agent-address` on insured requests and parses response headers (`x-x500-call-id`, `x-x500-premium`, `x-x500-refund`, `x-x500-outcome`).

Agents need **ALGO** in the wallet for transaction fees; merchant and insurance amounts use **USDC** (ASA `10458941`).

---

## Configuration

### Required

| Variable / option | Description |
|-------------------|-------------|
| `network` | Must be `"testnet"` in V1 |
| `address` | Algorand agent address (base32) |
| `mnemonic` | 25-word recovery phrase |

### Optional overrides

Live testnet defaults are built in. Override via `createX500({ … })` or environment variables:

| Option | Env var | Default |
|--------|---------|---------|
| `proxyUrl` | `MARKET_PROXY_URL` or `PROXY_URL` | `https://market-proxy-production.up.railway.app` |
| `indexerUrl` | `INDEXER_URL` | `https://indexer-production-ab11.up.railway.app` |
| `facilitatorUrl` | `FACILITATOR_URL` | `https://facilitator.goplausible.xyz` |
| `poolAppId` | `X500_POOL_APP_ID` | `769443375` |
| `deploymentsPath` | `X500_DEPLOYMENTS_PATH` | `config/deployments.algorand.testnet.json` |

For local development, point env vars at your own proxy/indexer (`http://127.0.0.1:8788` / `8787`).

---

## API reference

### `createX500(options)` → `X500Client`

Factory for the agent client. Throws if `network !== "testnet"`.

### HTTP methods

| Method | Description |
|--------|-------------|
| **`fetch(url, init?)`** | Insured fetch — drop-in replacement for `fetch`. Merchant origin URLs are auto-resolved to the proxy; proxy paths (`/v1/{slug}/…`) and full proxy URLs pass through. Handles x402 402 → pay → retry. |
| **`pay(url, init?)`** | x402-only payment path — no insurance wrap. Use for direct merchant USDC calls outside the proxy. |

### Merchant resolution

| Method | Description |
|--------|-------------|
| **`resolveMerchant(origin)`** | `GET /api/endpoints/resolve` — returns `{ slug, hostname, insuredUrl, apiPriceMicroUsdc, flatPremiumMicroAlgos }`. |

**Exported helpers** (import from `x500-agent-sdk`):

| Function | Description |
|----------|-------------|
| `insuredUrlForMerchant(url, opts?)` | Full merchant URL → insured proxy URL. |
| `normalizeMerchantOrigin(url)` | Strip path → `https://host`. |
| `insuredProxyUrl(slug, path?, base?)` | Build `{proxy}/v1/{slug}/{path}`. |
| `resolveMerchant(origin, opts?)` | Indexer resolve without creating a client. |

### Escrow & balance

| Method | Description |
|--------|-------------|
| **`setup({ escrowMicroAlgos? })`** | Grouped USDC ASA transfer + `deposit_escrow` on `X500Pool`. Default **3,000,000** microUSDC (3 USDC). Returns `{ transactionId, loraUrl }`. |
| **`topUp(microAlgos)`** | Additional USDC escrow deposit. |
| **`getBalance()`** | Agent wallet **USDC** balance in microUSDC (via indexer ASA balance read). |

> **Note:** TypeScript uses the parameter name `escrowMicroAlgos` and event fields `premiumMicroAlgos` / `refundMicroAlgos`; in V1 these values are **microUSDC** (6 decimals), not native ALGO.

### Indexer reads

| Method | Description |
|--------|-------------|
| **`getCall(callId)`** | `GET /api/calls/:id` — settlement status, outcome, tx id. |
| **`getAgent(address?)`** | `GET /api/agents/:address` — escrow stats and call history. |

### Events

```ts
x500.on("billed", (e) => {
  console.log(`Premium ${e.premiumMicroAlgos} microUSDC — call ${e.callId}`);
});

x500.on("refund", (e) => {
  console.log(`Refund ${e.refundMicroAlgos} microUSDC — call ${e.callId}`);
});

x500.on("failure", (e) => {
  console.log(`Failed: ${e.outcome} HTTP ${e.status}`);
});

x500.on("degraded", (e) => {
  console.log(`Settlement pending — call ${e.callId}`);
});
```

Each handler returns an unsubscribe function. Event payload type: `X500CallEvent`.

### Lifecycle

| Method | Description |
|--------|-------------|
| **`close()`** | Release resources. Call when done. |

---

## Response headers

When calling through the insured proxy, inspect:

| Header | Meaning |
|--------|---------|
| `x-x500-call-id` | Unique call id (maps to on-chain settlement) |
| `x-x500-outcome` | `ok`, `latency_breach`, `server_error`, `network_error`, `client_error`, … |
| `x-x500-premium` | Insurance premium charged (microUSDC) |
| `x-x500-refund` | Refund credited (microUSDC), `0` if none |
| `x-x500-asset` | `10458941` (testnet USDC ASA id) |
| `x-x500-network` | `algorand:testnet` |
| `x-x500-settlement-pending` | `1` if on-chain settle not yet confirmed |

Example economics (default registration): premium **10_000** (0.01 USDC); SLA breach refund **15_000** (0.005 USDC x402 ticket + 0.01 USDC premium).

View settlement transactions on [Lora](https://lora.algokit.io/testnet).

---

## LangChain / agent frameworks

See the monorepo examples:

- [`example/agent`](https://github.com/Marshal-AM/x500/tree/main/example/agent) — Groq + `get_insured_weather` tool
- **[Live chat UI](https://chat-production-acf6.up.railway.app/)** — browser demo with fast vs SLA-breach modes · local: [`chat`](https://github.com/Marshal-AM/x500/tree/main/chat)

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const weatherTool = tool(
  async ({ city }) => {
    const url = `${merchantOrigin}/paid/weather?city=${encodeURIComponent(city)}`;
    const res = await x500.fetch(url);
    return res.ok ? await res.text() : `error ${res.status}`;
  },
  {
    name: "get_insured_weather",
    schema: z.object({ city: z.string() }),
  },
);
```

---

## Prerequisites

1. **Algorand testnet account** with ALGO for fees ([AlgoKit faucet](https://lora.algokit.io/testnet/fund)).
2. **USDC** — opt in to ASA `10458941`; fund wallet for x402 merchant payments and insurance escrow.
3. **Insurance escrow** — `setup()` or `x500-algorand approve` once.
4. **Registered merchant** — register public origin URL in the [x500 dashboard](https://dashboard-production-915f.up.railway.app/) or indexer.

---

## CLI

Prefer a terminal? Use the companion package **[x500-algorand](https://www.npmjs.com/package/x500-algorand)**:

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
  USDC_TESTNET_ASA_ID,        // "10458941"
  ALGORAND_TESTNET,            // "algorand:testnet"
  DEFAULT_MARKET_PROXY_URL,
  DEFAULT_INDEXER_URL,
  DEFAULT_FACILITATOR_URL,
  DEFAULT_POOL_APP_ID,         // 769443375
  LORA_EXPLORER_BASE,
  loraTxUrl,
} from "x500-agent-sdk";
```

---

## Links

- [x500 monorepo & docs](https://github.com/Marshal-AM/x500)
- [Live dashboard](https://dashboard-production-915f.up.railway.app/endpoints) · [Live chat demo](https://chat-production-acf6.up.railway.app/)
- [Pool app on Lora (testnet)](https://lora.algokit.io/testnet/application/769443375)
- [Registry app on Lora (testnet)](https://lora.algokit.io/testnet/application/769438875)
- [x402 AVM mechanism](https://www.npmjs.com/package/@x402/avm)
- Example insured txs: [x402 payment](https://lora.algokit.io/testnet/transaction/HOT5NNDNKVVLHLNTCQIUYMKVQ3PKRFMNOOKHC5KIGSWSQG4QUYJQ), [SLA refund](https://lora.algokit.io/testnet/transaction/PG7Y5XUUUXRIFT5K2A2CPUSTDXQG4S4WPVRULAKN326IXYBEZ2WA)

---

## License

MIT
