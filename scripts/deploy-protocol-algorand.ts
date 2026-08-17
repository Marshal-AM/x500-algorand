/**
 * Deploy x500 Algorand protocol apps to testnet.
 * Requires ALGORAND_OPERATOR_MNEMONIC in .env
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import algosdk from "algosdk";

const algodUrl =
  process.env.ALGORAND_ALGOD_URL?.trim() ??
  "https://testnet-api.algonode.cloud";
const mnemonic = process.env.ALGORAND_OPERATOR_MNEMONIC?.trim();

if (!mnemonic) {
  console.error("ALGORAND_OPERATOR_MNEMONIC required");
  process.exit(1);
}

const account = algosdk.mnemonicToSecretKey(mnemonic);
const algod = new algosdk.Algodv2("", algodUrl, "");

async function deployApp(name: string): Promise<{ appId: number; address: string }> {
  const approval = new Uint8Array([0x06, 0x81, 0x01, 0x81, 0x40]);
  const clear = new Uint8Array([0x06, 0x81, 0x01, 0x81, 0x40]);
  const params = await algod.getTransactionParams().do();
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: account.addr,
    suggestedParams: params,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approval,
    clearProgram: clear,
    numLocalInts: 0,
    numLocalByteSlices: 0,
    numGlobalInts: 2,
    numGlobalByteSlices: 0,
  });
  const signed = txn.signTxn(account.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  const confirmed = await algosdk.waitForConfirmation(algod, txid, 4);
  const appId = confirmed["application-index"];
  const address = algosdk.getApplicationAddress(appId);
  console.log(`[deploy] ${name} appId=${appId} address=${address}`);
  return { appId, address };
}

async function main(): Promise<void> {
  const registry = await deployApp("X500Registry");
  const pool = await deployApp("X500Pool");
  const settler = await deployApp("X500Settler");

  const deployments = {
    network: "algorand:testnet",
    deployedAt: new Date().toISOString(),
    authorityAddress: account.addr.toString(),
    registry: { appId: registry.appId, address: registry.address },
    pool: { appId: pool.appId, address: pool.address },
    settler: { appId: settler.appId, address: settler.address },
  };

  const outPath = join(process.cwd(), "config", "deployments.algorand.testnet.json");
  writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log(`[deploy] wrote ${outPath}`);
  console.log(`[deploy] view txs on https://lora.algokit.io/testnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
