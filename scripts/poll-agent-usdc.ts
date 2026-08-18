import algosdk from "algosdk";

const USDC = 10458941;
const address = process.env.ALGORAND_AGENT_ADDRESS?.trim();
if (!address) {
  console.error("ALGORAND_AGENT_ADDRESS required");
  process.exit(1);
}

const algod = new algosdk.Algodv2(
  "",
  process.env.ALGORAND_ALGOD_URL?.trim() ??
    "https://testnet-api.algonode.cloud",
  "",
);

async function usdcMicro(): Promise<number> {
  const info = await algod.accountInformation(address).do();
  const asset = info.assets?.find((a) => Number(a["asset-id"]) === USDC);
  return Number(asset?.amount ?? 0);
}

async function main(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const amt = await usdcMicro();
    console.log(`${new Date().toISOString()} usdc_micro=${amt}`);
    if (amt > 0) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log("still 0 after polling");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
