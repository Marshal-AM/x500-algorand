# @x500/shared

Algorand-only chain adapter leaf.

## `AlgorandAdapter`

Implements `ChainAdapter` for `algorand:testnet`:

| Operation | Mechanism |
|-----------|-----------|
| Balance reads | Algorand indexer REST (free) |
| Endpoint reads | Indexer simulate on Registry app |
| `submitSettleBatch` | Paid on-chain app call via settler wallet |

### Methods

- **`getNativeAlgoBalance(address)`** — microAlgos via indexer
- **`checkAgentEligibility(address, premiumMicroAlgos)`** — escrow ≥ premium
- **`readEndpointConfigs()`** / **`getEndpoint(slug)`** — on-chain endpoint catalog
- **`submitSettleBatch(input)`** — settler-signed `settleBatch`

Requires `config/deployments.algorand.testnet.json` (or `deployments` option); otherwise throws `Phase2RequiredError` — never silent empty success.

Premium settlement uses prepaid ALGO escrow on `X500Pool` (not ASA opt-in allowances). Contract calls use `algosdk` against algod + indexer.

```ts
import { AlgorandAdapter } from "@x500/shared";

const adapter = new AlgorandAdapter({
  indexerUrl: "https://testnet-idx.algonode.cloud",
  algodUrl: "https://testnet-api.algonode.cloud",
  deploymentsPath: "config/deployments.algorand.testnet.json",
  settlerMnemonic: process.env.ALGORAND_SETTLER_MNEMONIC,
});
```
