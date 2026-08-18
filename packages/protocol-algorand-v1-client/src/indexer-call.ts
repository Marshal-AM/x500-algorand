/**
 * Free Algorand reads — account balance and app simulate via algod.
 */
import algosdk from "algosdk";

const DEFAULT_INDEXER = "https://testnet-idx.algonode.cloud";

type SimulateResponse = {
  txnGroups?: Array<{
    txnResults?: Array<{
      txnResult?: { appReturnValue?: Uint8Array };
    }>;
  }>;
};

export function indexerBaseUrl(): string {
  return (
    process.env.ALGORAND_INDEXER_URL?.trim() || DEFAULT_INDEXER
  ).replace(/\/$/, "");
}

export function algodBaseUrl(): string {
  return (
    process.env.ALGORAND_ALGOD_URL?.trim() ||
    "https://testnet-api.algonode.cloud"
  ).replace(/\/$/, "");
}

/** GET /v2/accounts/{address} — balance in microAlgos. */
export async function indexerAccountBalanceMicroAlgos(
  address: string,
  opts?: { indexerUrl?: string; fetchImpl?: typeof fetch },
): Promise<bigint> {
  const base = (opts?.indexerUrl ?? indexerBaseUrl()).replace(/\/$/, "");
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const res = await fetchImpl(`${base}/v2/accounts/${address}`);
  if (!res.ok) {
    throw new Error(`indexer account ${address}: ${res.status}`);
  }
  const body = (await res.json()) as { account?: { amount?: number } };
  return BigInt(body.account?.amount ?? 0);
}

const USDC_TESTNET_ASA_ID = 10458941;

/** GET /v2/accounts/{address} — USDC ASA balance in microUSDC (0 if not opted in). */
export async function indexerUsdcBalanceMicro(
  address: string,
  opts?: { indexerUrl?: string; fetchImpl?: typeof fetch; asaId?: number },
): Promise<bigint> {
  const base = (opts?.indexerUrl ?? indexerBaseUrl()).replace(/\/$/, "");
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const asaId = opts?.asaId ?? USDC_TESTNET_ASA_ID;
  const res = await fetchImpl(`${base}/v2/accounts/${address}`);
  if (!res.ok) {
    throw new Error(`indexer account ${address}: ${res.status}`);
  }
  const body = (await res.json()) as {
    account?: { assets?: Array<{ "asset-id"?: number; amount?: number }> };
  };
  const asset = body.account?.assets?.find((a) => a["asset-id"] === asaId);
  return BigInt(asset?.amount ?? 0);
}

/** Simulate a read-only app call via algod (free on public nodes). */
export async function indexerSimulateAppCall(
  appId: number,
  appArgs: Uint8Array[],
  opts?: {
    indexerUrl?: string;
    algodUrl?: string;
    fetchImpl?: typeof fetch;
    sender?: string;
    boxes?: Array<{ app: number; name: Uint8Array }>;
  },
): Promise<Uint8Array | null> {
  const algodUrl = (opts?.algodUrl ?? algodBaseUrl()).replace(/\/$/, "");
  const sender =
    opts?.sender ?? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

  const algod = new algosdk.Algodv2("", algodUrl, "");
  const suggestedParams = await algod.getTransactionParams().do();
  const boxes = opts?.boxes?.map((b) => ({
    appIndex: b.app,
    name: b.name,
  }));

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender,
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs,
    boxes,
    suggestedParams: {
      ...suggestedParams,
      fee: 0,
      flatFee: true,
    },
  });

  const simulateTxn = algosdk.encodeUnsignedSimulateTransaction(txn);

  try {
    const result = (await algod
      .simulateRawTransactions(simulateTxn)
      .do()) as SimulateResponse;
    const ret =
      result.txnGroups?.[0]?.txnResults?.[0]?.txnResult?.appReturnValue;
    if (!ret) return null;
    return Uint8Array.from(ret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`algod simulate failed: ${msg}`);
  }
}
