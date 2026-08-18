import algosdk from "algosdk";
import {
  encodeRegisterEndpoint,
  encodeSetEndpointSla,
  encodeSlug,
  encodeSlugIndexBox,
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

type BoxRef = { appIndex: number; name: Uint8Array };

/** Covers MBR for the endpoint box + slug-index box on first register. */
const REGISTER_BOX_FUNDING_MICROALGOS = 250_000;

function algodClient(): algosdk.Algodv2 {
  const server =
    process.env.NEXT_PUBLIC_ALGOD_SERVER?.trim() ||
    "https://testnet-api.algonode.cloud";
  const port = process.env.NEXT_PUBLIC_ALGOD_PORT?.trim() || "443";
  const token = process.env.NEXT_PUBLIC_ALGOD_TOKEN?.trim() || "";
  return new algosdk.Algodv2(token, server, port);
}

function decodeGlobalStateKey(key: unknown): string {
  if (typeof key === "string") {
    const fromB64 = Buffer.from(key, "base64").toString("utf8");
    return fromB64 || key;
  }
  return Buffer.from(key as Uint8Array).toString("utf8");
}

function slugBox(appId: number, slug: string): BoxRef {
  return { appIndex: appId, name: encodeSlug(slug) };
}

async function fetchSlugCount(appId: number): Promise<number> {
  const app = await algodClient().getApplicationByID(appId).do();
  const globalState = app.params?.globalState ?? [];
  for (const kv of globalState) {
    if (decodeGlobalStateKey(kv.key) !== "slugCount") continue;
    return Number(kv.value.uint ?? 0);
  }
  return 0;
}

async function signAndSubmit(opts: {
  txns: algosdk.Transaction[];
  transactionSigner: TransactionSigner;
}): Promise<string> {
  const group = algosdk.assignGroupID(opts.txns);
  const signed = await opts.transactionSigner(
    group,
    group.map((_, index) => index),
  );
  const algod = algodClient();
  const response = await algod.sendRawTransaction(signed).do();
  const txId = response.txid;
  await algosdk.waitForConfirmation(algod, txId, 4);
  return txId;
}

function makeAppCall(opts: {
  sender: string;
  appId: number;
  appArgs: Uint8Array[];
  boxes: BoxRef[];
  suggestedParams: algosdk.SuggestedParams;
}): algosdk.Transaction {
  return algosdk.makeApplicationCallTxnFromObject({
    sender: opts.sender,
    appIndex: opts.appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: opts.appArgs,
    boxes: opts.boxes,
    suggestedParams: opts.suggestedParams,
  });
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

async function submitRegister(opts: {
  session: WalletSession;
  registryAppId: number;
  slug: string;
  hostname: string;
  apiPriceMicroUsdc: bigint;
  contactAddress: string;
  slaLatencyMs: number;
  transactionSigner: TransactionSigner;
}): Promise<string> {
  const algod = algodClient();
  const suggestedParams = await algod.getTransactionParams().do();
  const slugIndex = await fetchSlugCount(opts.registryAppId);
  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: opts.session.address,
    receiver: algosdk.getApplicationAddress(opts.registryAppId),
    amount: REGISTER_BOX_FUNDING_MICROALGOS,
    suggestedParams,
  });
  const appTxn = makeAppCall({
    sender: opts.session.address,
    appId: opts.registryAppId,
    appArgs: encodeRegisterEndpoint({
      slug: opts.slug,
      hostname: opts.hostname,
      apiPriceMicroUsdc: opts.apiPriceMicroUsdc,
      contactAddress: opts.contactAddress,
      slaLatencyMs: opts.slaLatencyMs,
    }),
    boxes: [
      slugBox(opts.registryAppId, opts.slug),
      {
        appIndex: opts.registryAppId,
        name: encodeSlugIndexBox(slugIndex),
      },
    ],
    suggestedParams,
  });
  return signAndSubmit({
    txns: [payTxn, appTxn],
    transactionSigner: opts.transactionSigner,
  });
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

  if (opts.mode === "register") {
    try {
      const transactionId = await submitRegister({ ...opts, slaLatencyMs });
      return { transactionId, updated: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("invalid Box reference")) throw err;
      const transactionId = await submitRegister({ ...opts, slaLatencyMs });
      return { transactionId, updated: false };
    }
  }

  const suggestedParams = await algodClient().getTransactionParams().do();
  const endpointBox = slugBox(opts.registryAppId, opts.slug);

  const transactionId = await signAndSubmit({
    txns: [
      makeAppCall({
        sender: opts.session.address,
        appId: opts.registryAppId,
        appArgs: encodeUpdateEndpoint({
          slug: opts.slug,
          hostname: opts.hostname,
          apiPriceMicroUsdc: opts.apiPriceMicroUsdc,
          contactAddress: opts.contactAddress,
        }),
        boxes: [endpointBox],
        suggestedParams,
      }),
    ],
    transactionSigner: opts.transactionSigner,
  });

  if (slaLatencyMs > 0) {
    await signAndSubmit({
      txns: [
        makeAppCall({
          sender: opts.session.address,
          appId: opts.registryAppId,
          appArgs: encodeSetEndpointSla(opts.slug, slaLatencyMs),
          boxes: [endpointBox],
          suggestedParams: await algodClient().getTransactionParams().do(),
        }),
      ],
      transactionSigner: opts.transactionSigner,
    });
  }

  return { transactionId, updated: true };
}
