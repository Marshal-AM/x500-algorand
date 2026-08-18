/**
 * Shared Algorand testnet helpers for x500 scripts.
 */
import algosdk from "algosdk";
import { loadDeployments } from "x500-protocol-algorand-v1-client";

export function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function algodClient(): algosdk.Algodv2 {
  const url =
    process.env.ALGORAND_ALGOD_URL?.trim() ??
    "https://testnet-api.algonode.cloud";
  return new algosdk.Algodv2("", url, "");
}

export function operatorAccount(): algosdk.Account {
  const mnemonic = requireEnv("ALGORAND_OPERATOR_MNEMONIC");
  return algosdk.mnemonicToSecretKey(mnemonic);
}

export async function submitAppCall(opts: {
  appId: number;
  appArgs?: Uint8Array[];
  boxes?: algosdk.BoxReference[];
  payment?: algosdk.Transaction;
  assetTransfer?: algosdk.Transaction;
  foreignAssets?: number[];
  /** Flat fee for the app call txn (covers inner txns when needed). */
  feeMicroAlgos?: number;
}): Promise<string> {
  const account = operatorAccount();
  const algod = algodClient();
  const suggestedParams = await algod.getTransactionParams().do();
  const baseFee = Math.max(Number(suggestedParams.fee ?? 1000), 1000);
  const fee =
    opts.feeMicroAlgos ??
    baseFee + (opts.foreignAssets?.length ? 2000 : 0);
  const txns: algosdk.Transaction[] = [];
  if (opts.payment) {
    txns.push(opts.payment);
  }
  if (opts.assetTransfer) {
    txns.push(opts.assetTransfer);
  }
  txns.push(
    algosdk.makeApplicationCallTxnFromObject({
      sender: account.addr,
      appIndex: opts.appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: opts.appArgs ?? [],
      boxes: opts.boxes,
      foreignAssets: opts.foreignAssets,
      suggestedParams: {
        ...suggestedParams,
        fee,
        flatFee: true,
      },
    }),
  );
  const group = algosdk.assignGroupID(txns);
  const signed = group.map((txn) => txn.signTxn(account.sk));
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 10);
  return txid;
}

export function deployments() {
  const path = process.env.X500_DEPLOYMENTS_PATH?.trim();
  return loadDeployments(path || undefined);
}
