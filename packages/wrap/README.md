# @x500/wrap

Insured fetch primitive for x500 on Algorand. Classifies HTTP outcomes, prices premium/refund in **microAlgos**, publishes settlement events to `ALGORAND_SUPABASE_*`, attaches `X-X500-*` headers.

## Covered-breach matrix

| Outcome | Covered | Premium | Refund |
|---------|---------|---------|--------|
| `ok` | yes | flat (microAlgos) | 0 |
| `latency_breach` (`slow`) | yes | flat | imputed + flat |
| `server_error` | yes | flat | imputed + flat |
| `network_error` | yes | flat | imputed + flat |
| `client_error` | no | 0 | 0 |

- **Insurance layer:** amounts in **microAlgos** (ALGO escrow).
- **Merchant x402 layer:** `asset` must be USDC testnet ASA `10458941` (amounts in **microUSDC**).
- **Network:** `algorand:testnet` only.

## Key exports

| Export | Role |
|--------|------|
| `wrapFetch` | Insured upstream call + classify + economics + headers |
| `computeEconomics` | Premium/refund from outcome + pool config |
| `attachX500Headers` | `X-X500-Premium`, `X-X500-Refund`, `X-X500-Outcome`, … |
| `SupabaseEventSink` | Queue `settle_jobs` via `ALGORAND_SUPABASE_*` |
