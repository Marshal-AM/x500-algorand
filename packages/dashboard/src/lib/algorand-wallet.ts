import algosdk from "algosdk";
import {
  encodeRegisterEndpoint,
  encodeSetEndpointSla,
  encodeSlug,
  encodeUpdateEndpoint,
} from "x500-protocol-algorand-v1-client";
import { indexerBase } from "@/lib/indexer";

export interface WalletSession {
  address: string;
}

type TransactionSigner = (
  txnGroup: algosdk.Transaction[],
  indexesToSign: number[],
) => Promise<Uint8Array[]>;

function algodClient(): algosdk.Algodv2 {
  const server =
    process.env.NEXT_PUBLIC_ALGOD_SERVER?.trim() ||
    "https://testnet-api.algonode.cloud";
  const port = process.env.NEXT_PUBLIC_ALGOD_PORT?.trim() || "443";
  const token = process.env.NEXT_PUBLIC_ALGOD_TOKEN?.trim() || "";
  return new algosdk.Algodv2(token, server, port);
}

async function signAndSubmitAppCall(opts: {
  appId: number;
  sender: string;
  appArgs: Uint8Array[];
  transactionSigner: TransactionSigner;
  boxes?: Array<{ appIndex: number; name: Uint8Array }>;
}): Promise<string> {
  const algod = algodClient();
  const suggestedParams = await algod.getTransactionParams().do();
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: opts.sender,
    appIndex: opts.appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: opts.appArgs,
    boxes: opts.boxes,
    suggestedParams,
  });
  const signed = await opts.transactionSigner([txn], [0]);
  const response = await algod.sendRawTransaction(signed[0]).do();
  const txId = response.txid;
  await algosdk.waitForConfirmation(algod, txId, 4);
  return txId;
}

export async function fetchRegistryAppId(): Promise<number> {
  const res = await fetch(`${indexerBase()}/api/config`);
  if (!res.ok) {
    throw new Error(`failed to load protocol config (${res.status})`);
  }
  const body = (await res.json()) as {
    registryAppId?: number | string;
    registry_app_id?: number | string;
    error?: string;
  };
  const raw = body.registryAppId ?? body.registry_app_id;
  if (raw == null || raw === "") {
    throw new Error(body.error ?? "registry app id missing from indexer");
  }
  const appId = Number(raw);
  if (!Number.isFinite(appId) || appId <= 0) {
    throw new Error("registry app id is invalid");
  }
  return appId;
}

export async function submitEndpointWithWallet(opts: {
  mode: "register" | "update";
  session: WalletSession;
  registryAppId: number;
  slug: string;
  hostname: string;
  apiPriceMicroUsdc: bigint;
  contactAddress: string;
  slaLatencyMs?: number;
  transactionSigner: TransactionSigner;
}): Promise<{ transactionId: string; updated: boolean }> {
  const slaLatencyMs = opts.slaLatencyMs ?? 0;
  const slugBytes = encodeSlug(opts.slug);
  const boxRef = {
    appIndex: opts.registryAppId,
    name: slugBytes,
  };

  if (opts.mode === "register") {
    const appArgs = encodeRegisterEndpoint({
      slug: opts.slug,
      hostname: opts.hostname,
      apiPriceMicroUsdc: opts.apiPriceMicroUsdc,
      contactAddress: opts.contactAddress,
      slaLatencyMs,
    });
    const transactionId = await signAndSubmitAppCall({
      appId: opts.registryAppId,
      sender: opts.session.address,
      appArgs,
      transactionSigner: opts.transactionSigner,
      boxes: [boxRef],
    });
    return { transactionId, updated: false };
  }

  const updateArgs = encodeUpdateEndpoint({
    slug: opts.slug,
    hostname: opts.hostname,
    apiPriceMicroUsdc: opts.apiPriceMicroUsdc,
    contactAddress: opts.contactAddress,
  });
  const transactionId = await signAndSubmitAppCall({
    appId: opts.registryAppId,
    sender: opts.session.address,
    appArgs: updateArgs,
    transactionSigner: opts.transactionSigner,
    boxes: [boxRef],
  });

  if (slaLatencyMs > 0) {
    await signAndSubmitAppCall({
      appId: opts.registryAppId,
      sender: opts.session.address,
      appArgs: encodeSetEndpointSla(opts.slug, slaLatencyMs),
      transactionSigner: opts.transactionSigner,
      boxes: [boxRef],
    });
  }

  return { transactionId, updated: true };
}
