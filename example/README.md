# x500 examples (Algorand)

End-to-end demo: merchant weather API server + LangChain agent with insured calls on **Algorand testnet**.

- Merchant payments: **USDC** via x402 (`facilitator.goplausible.xyz`)
- Insurance: **ALGO** escrow via `x500-sdk-algorand`

## Quick start

### 1. Server + ngrok

```bash
pnpm example:server
```

Copy the **ngrok URL** from the console.

### 2. Dashboard — register merchant

```bash
pnpm dashboard:dev
```

Open http://localhost:3000/merchants/register — connect **Pera** or **Defly**.

| Field | Value |
|-------|--------|
| Slug | any name (internal) |
| Origin URL | ngrok URL from step 1 |
| API price | e.g. `0.01` USDC |
| Contact address | your Algorand wallet (receives API payments) |

Server picks up price + address from the indexer automatically.

### 3. Agent

```bash
cd example/agent
cp .env.example .env
# GROQ_API_KEY, X500_AGENT_ADDRESS, ALGORAND_AGENT_MNEMONIC, X500_MERCHANT_ORIGIN
pnpm install
pnpm dev
```

Ask: **"What's the weather in Paris?"**

You should see:
- Merchant API charge (x402 USDC → merchant)
- Insurance premium (ALGO escrow → pool)

### 4. Refund test

1. With server running — agent succeeds; watch `[x500] Premium charged`
2. Stop the server (`Ctrl+C`)
3. Ask again — observe `[x500] Refund received` after settlement

## Agent escrow

If calls fail with insufficient escrow:

```bash
export X500_AGENT_ADDRESS=…
export ALGORAND_AGENT_MNEMONIC="…"
npx x500-algorand --network testnet approve
```

Or `createX500().setup()` in a one-off script.

## Sub-projects

- [`server/README.md`](server/README.md) — x402 weather merchant
- [`agent/README.md`](agent/README.md) — LangChain + `x500-sdk-algorand`
