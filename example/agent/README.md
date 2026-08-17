# Example: LangChain agent + x500-sdk-algorand

Interactive CLI agent powered by **Groq** (`openai/gpt-oss-120b`) with a tool that fetches insured weather from your registered merchant through the x500 market proxy.

## Prerequisites

1. Algorand testnet agent account with ALGO ([faucet](https://bank.testnet.algorand.network/))
2. Escrow funded: `x500-algorand approve` or SDK `setup()`
3. Merchant registered in dashboard with your **origin URL** (slug resolved automatically)
4. [Groq API key](https://console.groq.com/keys) in `.env`

## Setup

```bash
cd example/agent
cp .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Groq chat model |
| `X500_AGENT_ADDRESS` | Agent Algorand address |
| `ALGORAND_AGENT_MNEMONIC` | 25-word phrase |
| `X500_MERCHANT_ORIGIN` | ngrok URL from example server (no trailing path) |

```bash
pnpm install
pnpm dev
```

## Try it

```
You> What's the weather in Tokyo?
```

Stop the example server and ask again to observe x500 refund events. Settlement txs appear on [Lora](https://lora.algokit.io/testnet).
