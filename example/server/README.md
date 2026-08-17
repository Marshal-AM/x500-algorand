# Example: weather server + ngrok

Merchant API for the x500 Algorand demo. Pricing and pay-to address come from dashboard registration — **no merchant secrets in `.env`**.

## `.env`

```
SERVER_PORT=8800
NGROK_AUTHTOKEN=your_token
```

## Flow

1. `pnpm dev` → ngrok HTTPS URL printed
2. Register that URL + API price (microUSDC) + Algorand contact address in the **dashboard** (Pera / Defly)
3. Server polls the indexer and exposes `/paid/weather`

x402 USDC settlement uses `https://facilitator.goplausible.xyz` (platform default).

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/paid/weather?city=London` | x402-paid city weather (Open-Meteo) |
| GET | `/health` | Health check |

## Slow variant (SLA breach testing)

```bash
pnpm dev:slow
```

Same `/paid/weather` route with a ~70s artificial delay after payment settlement — triggers `latency_breach` refunds in the agent.
