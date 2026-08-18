import algosdk from "algosdk";

const address = process.env.ALGORAND_AGENT_ADDRESS?.trim();
if (!address) {
  console.error("ALGORAND_AGENT_ADDRESS required");
  process.exit(1);
}

const indexerUrl =
  process.env.ALGORAND_INDEXER_URL?.trim() ??
  "https://testnet-idx.algonode.cloud";

async function main(): Promise<void> {
  const res = await fetch(`${indexerUrl}/v2/accounts/${address}`);
  const body = (await res.json()) as {
    account?: {
      amount?: number;
      assets?: Array<{
        "asset-id": number;
        amount: number;
        "is-frozen": boolean;
      }>;
    };
  };
  console.log("Expected agent address:", address);
  console.log("Expected USDC ASA ID: 10458941 (Circle Algorand testnet)");
  console.log("ALGO:", (body.account?.amount ?? 0) / 1e6);
  const assets = body.account?.assets ?? [];
  if (assets.length === 0) {
    console.log("No ASA holdings (only USDC opt-in empty balance?)");
  } else {
    console.log("ASA holdings:");
    for (const a of assets) {
      console.log(
        `  asset-id=${a["asset-id"]} amount=${a.amount} (${a.amount / 1e6} units) frozen=${a["is-frozen"]}`,
      );
    }
  }

  const txRes = await fetch(
    `${indexerUrl}/v2/transactions?address=${address}&limit=10`,
  );
  const txBody = (await txRes.json()) as {
    transactions?: Array<{
      id: string;
      "tx-type": string;
      "round-time": number;
      "asset-transfer-transaction"?: {
        amount: number;
        "asset-id": number;
        receiver: string;
        sender: string;
      };
    }>;
  };
  console.log("\nRecent transactions:");
  for (const t of txBody.transactions ?? []) {
    const ax = t["asset-transfer-transaction"];
  if (ax) {
      console.log(
        `  ${t.id} axfer asset=${ax["asset-id"]} amt=${ax.amount} from=${ax.sender.slice(0, 8)}… to=${ax.receiver.slice(0, 8)}…`,
      );
    } else {
      console.log(`  ${t.id} type=${t["tx-type"]}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
