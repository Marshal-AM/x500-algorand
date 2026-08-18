import { createX500 } from "../packages/x500-sdk-algorand/src/createX500.ts";

async function main(): Promise<void> {
  const address = process.env.ALGORAND_AGENT_ADDRESS?.trim();
  const mnemonic = process.env.ALGORAND_AGENT_MNEMONIC?.trim();
  if (!address || !mnemonic) throw new Error("agent creds required");

  const micro = BigInt(process.argv[2] ?? "3000000");
  const x500 = createX500({ network: "testnet", address, mnemonic });
  const { transactionId, loraUrl } = await x500.setup({ escrowMicroAlgos: micro });
  console.log(`[ok] escrow deposit ${Number(micro) / 1e6} USDC tx=${transactionId}`);
  console.log(loraUrl);
  await x500.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
