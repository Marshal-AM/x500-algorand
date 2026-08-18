import algosdk from "algosdk";

const USDC = 10458941;
const algod = new algosdk.Algodv2(
  "",
  process.env.ALGORAND_ALGOD_URL?.trim() ??
    "https://testnet-api.algonode.cloud",
  "",
);

async function show(label: string, addr: string): Promise<void> {
  const info = await algod.accountInformation(addr).do();
  const usdc = info.assets?.find((a) => Number(a["asset-id"]) === USDC);
  console.log(
    `${label} ${addr} algo=${Number(info.amount) / 1e6} usdc=${Number(usdc?.amount ?? 0) / 1e6}`,
  );
}

async function main(): Promise<void> {
  const keys = [
    "ALGORAND_OPERATOR_ADDRESS",
    "ALGORAND_AGENT_ADDRESS",
    "ALGORAND_MERCHANT_ADDRESS",
  ];
  for (const k of keys) {
    const addr = process.env[k]?.trim();
    if (addr) await show(k, addr);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
