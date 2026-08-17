/**
 * Free Algorand indexer reads — account balance and app simulate.
 */

const DEFAULT_INDEXER = "https://testnet-idx.algonode.cloud";

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

/** POST /v2/transactions/simulate — read-only app call. */
export async function indexerSimulateAppCall(
  appId: number,
  appArgs: Uint8Array[],
  opts?: {
    indexerUrl?: string;
    fetchImpl?: typeof fetch;
    sender?: string;
    boxes?: Array<{ app: number; name: Uint8Array }>;
  },
): Promise<Uint8Array | null> {
  const base = (opts?.indexerUrl ?? indexerBaseUrl()).replace(/\/$/, "");
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const sender =
    opts?.sender ?? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

  const txn = {
    txn: {
      type: "appl",
      snd: sender,
      fee: 0,
      fv: 0,
      lv: 0,
      gh: "SGO4GKS7F7Z2EBTVHAS4O3TJNHXHZ7HVZ7XK63N2QWAZEVIEAEKUAGINHM",
      apid: appId,
      apan: { onCompletion: "noop", foreignApps: [], foreignAssets: [] },
      apaa: appArgs.map((a) => Buffer.from(a).toString("base64")),
      apbx: opts?.boxes?.map((b) => ({
        app: b.app,
        name: Buffer.from(b.name).toString("base64"),
      })),
    },
  };

  const res = await fetchImpl(`${base}/v2/transactions/simulate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      format: "json",
      txnGroups: [{ txns: [txn] }],
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`indexer simulate ${res.status}: ${body}`);
  }
  const parsed = JSON.parse(body) as {
    txnGroups?: Array<{
      txnResults?: Array<{
        txnResult?: { appReturnValue?: string };
      }>;
    }>;
  };
  const ret = parsed.txnGroups?.[0]?.txnResults?.[0]?.txnResult?.appReturnValue;
  if (!ret) return null;
  return Uint8Array.from(Buffer.from(ret, "base64"));
}
