/**
 * Free Algorand reads — account balance and app simulate via algod.
 */
import algosdk from "algosdk";

const DEFAULT_INDEXER = "https://testnet-idx.algonode.cloud";

const ABI_RETURN_PREFIX = Buffer.from("151f7c75", "hex");

/** Pull the ARC-4 return value from an algod simulate response (last log). */
export function abiReturnFromSimulate(result: unknown): Uint8Array | null {
  const root = result as Record<string, unknown>;
  const groups = (root.txnGroups ?? root["txn-groups"]) as
    | Array<Record<string, unknown>>
    | undefined;
  const group = groups?.[0];
  const failure = group?.failureMessage ?? group?.["failure-message"];
  if (typeof failure === "string" && failure.length > 0) {
    throw new Error(failure);
  }
  const txnResults = (group?.txnResults ?? group?.["txn-results"]) as
    | Array<Record<string, unknown>>
    | undefined;
  const pending = (txnResults?.[0]?.txnResult ??
    txnResults?.[0]?.["txn-result"]) as Record<string, unknown> | undefined;
  const logs = (pending?.logs ?? []) as unknown[];
  if (logs.length === 0) return null;
  const last = logs[logs.length - 1];
  const bytes =
    last instanceof Uint8Array
      ? Buffer.from(last)
      : typeof last === "string"
        ? Buffer.from(last, "base64")
        : Buffer.from(Uint8Array.from(last as Iterable<number>));
  if (
    bytes.length >= ABI_RETURN_PREFIX.length &&
    bytes.subarray(0, 4).equals(ABI_RETURN_PREFIX)
  ) {
    return Uint8Array.from(bytes.subarray(4));
  }
  return Uint8Array.from(bytes);
}

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
  const algod = new algosdk.Algodv2("", algodUrl, "");
  // Simulate still checks the sender can pay the fee. The registry app
  // account is funded by register() box deposits, so it works without a
  // dedicated operator wallet. Override with ALGORAND_SIMULATE_SENDER.
  const sender =
    opts?.sender ??
    process.env.ALGORAND_SIMULATE_SENDER?.trim() ??
    algosdk.getApplicationAddress(appId).toString();
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
      fee: Number(suggestedParams.minFee ?? suggestedParams.fee ?? 1000) || 1000,
      flatFee: true,
    },
  });

  const unsigned = algosdk.encodeUnsignedSimulateTransaction(txn);
  const request = new algosdk.modelsv2.SimulateRequest({
    txnGroups: [
      new algosdk.modelsv2.SimulateRequestTransactionGroup({
        txns: [algosdk.decodeSignedTransaction(unsigned)],
      }),
    ],
    allowEmptySignatures: true,
    allowUnnamedResources: true,
  });

  try {
    const result = await algod.simulateTransactions(request).do();
    return abiReturnFromSimulate(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`algod simulate failed: ${msg}`);
  }
}
