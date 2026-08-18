import algosdk from "algosdk";
import { loadDeployments } from "x500-protocol-algorand-v1-client";

async function main(): Promise<void> {
  const agent = process.env.ALGORAND_AGENT_ADDRESS?.trim();
  if (!agent) throw new Error("ALGORAND_AGENT_ADDRESS required");

  const d = loadDeployments(process.env.X500_DEPLOYMENTS_PATH);
  const algod = new algosdk.Algodv2(
    "",
    process.env.ALGORAND_ALGOD_URL?.trim() ??
      "https://testnet-api.algonode.cloud",
    "",
  );
  const pk = algosdk.decodeAddress(agent).publicKey;
  const name = Uint8Array.from([...Buffer.from("e"), ...pk]);
  try {
    const box = await algod.getApplicationBoxByName(d.pool.appId, name).do();
    const buf = Buffer.from(box.value);
    const micro = buf.length >= 8 ? buf.readBigUInt64BE(buf.length - 8) : 0n;
    console.log("escrow_micro_usdc", micro.toString());
  } catch {
    console.log("escrow_micro_usdc", "0");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
