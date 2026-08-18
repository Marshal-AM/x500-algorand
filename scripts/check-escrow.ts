import { encodeEscrowOf } from "x500-protocol-algorand-v1-client";
import { loadDeployments } from "x500-protocol-algorand-v1-client";
import algosdk from "algosdk";
import { indexerSimulateAppCall } from "x500-protocol-algorand-v1-client";

const agent = process.env.ALGORAND_AGENT_ADDRESS!.trim();
const d = loadDeployments(process.env.X500_DEPLOYMENTS_PATH);

function poolEscrowBoxName(agentAddress: string): Uint8Array {
  const pk = algosdk.decodeAddress(agentAddress).publicKey;
  return Uint8Array.from([...Buffer.from("e"), ...pk]);
}

async function main() {
  console.log("pool", d.pool.appId);
  const algod = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
  const suggestedParams = await algod.getTransactionParams().do();
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: agent,
    appIndex: d.pool.appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: encodeEscrowOf(agent),
    boxes: [{ appIndex: d.pool.appId, name: poolEscrowBoxName(agent) }],
    suggestedParams: { ...suggestedParams, fee: 0, flatFee: true },
  });
  const sim = await algod.simulateRawTransactions(
    algosdk.encodeUnsignedSimulateTransaction(txn),
  ).do();
  const ret = sim.txnGroups?.[0]?.txnResults?.[0]?.txnResult?.appReturnValue;
  console.log("appReturnValue", ret ? Buffer.from(ret).toString("hex") : "null");
}

main().catch(console.error);
