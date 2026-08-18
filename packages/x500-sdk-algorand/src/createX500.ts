import algosdk from "algosdk";
import { x402Client } from "@x402/core/client";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";
import type { ClientAvmSigner } from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { wrapFetchWithPayment } from "./wrapFetchWithPayment.js";
import { encodeDepositEscrow, indexerUsdcBalanceMicro } from "x500-protocol-algorand-v1-client";
import {
  DEFAULT_FACILITATOR_URL,
  DEFAULT_INDEXER_URL,
  DEFAULT_MARKET_PROXY_URL,
  resolveDefaultPoolAppId,
  insuredProxyUrl,
  loraTxUrl,
} from "./defaults.js";
import {
  insuredUrlForMerchant,
  resolveMerchant,
  splitMerchantUrl,
} from "./resolveMerchant.js";

export const USDC_TESTNET_ASA_ID = "10458941" as const;
export const ALGORAND_TESTNET = "algorand:testnet" as const;

export type X500EventName = "refund" | "billed" | "degraded" | "failure";

export interface X500CallEvent {
  callId: string | null;
  premiumMicroAlgos: string | null;
  refundMicroAlgos: string | null;
  outcome: string | null;
  asset: string | null;
  network: string | null;
  status: number;
  url: string;
}

export type X500EventHandler = (event: X500CallEvent) => void;

export interface CreateX500Options {
  network: "testnet" | "mainnet";
  address: string;
  mnemonic: string;
  proxyUrl?: string;
  indexerUrl?: string;
  facilitatorUrl?: string;
  deploymentsPath?: string;
  poolAppId?: number;
  fetchImpl?: typeof fetch;
}

export interface X500Client {
  readonly address: string;
  readonly proxyUrl: string;
  readonly indexerUrl: string;
  readonly facilitatorUrl: string;
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
  pay(input: string | URL, init?: RequestInit): Promise<Response>;
  setup(opts?: { escrowMicroAlgos?: bigint }): Promise<{ transactionId: string; loraUrl: string }>;
  topUp(microAlgos: bigint): Promise<{ transactionId: string; loraUrl: string }>;
  on(event: X500EventName, handler: X500EventHandler): () => void;
  getCall(callId: string): Promise<unknown>;
  getAgent(address?: string): Promise<unknown>;
  getBalance(): Promise<bigint>;
  resolveMerchant(origin: string): Promise<{
    slug: string;
    hostname: string;
    insuredUrl: string;
    apiPriceMicroUsdc?: string;
    flatPremiumMicroAlgos?: string;
  }>;
  close(): Promise<void>;
}

function requireTestnet(network: string): void {
  if (network !== "testnet") {
    throw new Error(
      `x500-agent-sdk V1 supports network "testnet" only (got ${JSON.stringify(network)})`,
    );
  }
}

function resolvePoolAppId(opts: CreateX500Options): number {
  if (opts.poolAppId != null && opts.poolAppId > 0) return opts.poolAppId;
  const env = process.env.X500_POOL_APP_ID?.trim();
  if (env) return Number(env);
  return resolveDefaultPoolAppId();
}

function accountAddress(account: algosdk.Account): string {
  return account.addr.toString();
}

function createAvmSigner(account: algosdk.Account): ClientAvmSigner {
  return {
    address: accountAddress(account),
    signTransactions: async (txns: Uint8Array[]) => {
      return txns.map((txnBytes) => {
        const txn = algosdk.decodeUnsignedTransaction(txnBytes);
        return algosdk.signTransaction(txn, account.sk).blob;
      });
    },
  };
}

function poolEscrowBoxName(agentAddress: string): Uint8Array {
  const pk = algosdk.decodeAddress(agentAddress).publicKey;
  return Uint8Array.from([...Buffer.from("e"), ...pk]);
}

export function createX500(opts: CreateX500Options): X500Client {
  requireTestnet(opts.network);
  if (!opts.address?.trim() || !opts.mnemonic?.trim()) {
    throw new Error("createX500 requires address + mnemonic for the agent");
  }

  const address = opts.address.trim();
  const account = algosdk.mnemonicToSecretKey(opts.mnemonic.trim());
  if (accountAddress(account) !== address) {
    throw new Error("createX500: mnemonic does not match address");
  }

  const proxyUrl = (
    opts.proxyUrl ??
    process.env.MARKET_PROXY_URL ??
    process.env.PROXY_URL ??
    DEFAULT_MARKET_PROXY_URL
  ).replace(/\/$/, "");
  const indexerUrl = (
    opts.indexerUrl ?? process.env.INDEXER_URL ?? DEFAULT_INDEXER_URL
  ).replace(/\/$/, "");
  const facilitatorUrl = (
    opts.facilitatorUrl ??
    process.env.FACILITATOR_URL ??
    DEFAULT_FACILITATOR_URL
  ).replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const algodUrl =
    process.env.ALGORAND_ALGOD_URL?.trim() ??
    "https://testnet-api.algonode.cloud";

  const x402Signer = createAvmSigner(account);
  const client = new x402Client();
  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(x402Signer));
  const payFetch = wrapFetchWithPayment(fetchImpl, client);

  const listeners = new Map<X500EventName, Set<X500EventHandler>>();

  function emit(name: X500EventName, event: X500CallEvent): void {
    const set = listeners.get(name);
    if (!set) return;
    for (const h of set) h(event);
  }

  function emitFromResponse(url: string, res: Response): void {
    const callId = res.headers.get("x-x500-call-id");
    const premium = res.headers.get("x-x500-premium");
    const refund = res.headers.get("x-x500-refund");
    const outcome = res.headers.get("x-x500-outcome");
    const asset = res.headers.get("x-x500-asset");
    const network = res.headers.get("x-x500-network");
    const event: X500CallEvent = {
      callId,
      premiumMicroAlgos: premium,
      refundMicroAlgos: refund,
      outcome,
      asset,
      network,
      status: res.status,
      url,
    };
    if (refund && BigInt(refund) > 0n) emit("refund", event);
    if (premium && BigInt(premium) > 0n) emit("billed", event);
    if (
      outcome === "degraded" ||
      res.headers.get("x-x500-settlement-pending") === "1"
    ) {
      emit("degraded", event);
    }
    if (!res.ok || outcome === "server_error" || outcome === "network_error") {
      emit("failure", event);
    }
  }

  function withAgentHeaders(init?: RequestInit): RequestInit {
    const headers = new Headers(init?.headers);
    headers.set("x-x500-agent-address", address);
    return { ...init, headers };
  }

  async function payOnce(
    input: string | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input.toString();
    return payFetch(url, init);
  }

  async function escrowDeposit(
    microAlgos: bigint,
  ): Promise<{ transactionId: string; loraUrl: string }> {
    if (microAlgos <= 0n) {
      throw new Error("escrow amount must be > 0 microAlgos");
    }
    const poolAppId = resolvePoolAppId(opts);
    if (!poolAppId) {
      throw new Error("pool app id not configured — deploy protocol first");
    }

    const usdcAsaId = Number(USDC_TESTNET_ASA_ID);
    const algod = new algosdk.Algodv2("", algodUrl, "");
    const suggestedParams = await algod.getTransactionParams().do();
    const poolAddr = algosdk.getApplicationAddress(poolAppId);
    const axferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: account.addr,
      receiver: poolAddr,
      assetIndex: usdcAsaId,
      amount: microAlgos,
      suggestedParams,
    });
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      sender: account.addr,
      appIndex: poolAppId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: encodeDepositEscrow(),
      boxes: [
        {
          appIndex: poolAppId,
          name: poolEscrowBoxName(address),
        },
      ],
      suggestedParams,
    });
    const txnGroup = algosdk.assignGroupID([axferTxn, appCallTxn]);
    const signed = txnGroup.map((txn) => txn.signTxn(account.sk));
    const { txid } = await algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algod, txid, 4);
    return { transactionId: txid, loraUrl: loraTxUrl(txid) };
  }

  async function toInsuredTarget(url: string): Promise<string> {
    if (url.startsWith(proxyUrl)) return url;
    if (url.startsWith("/v1/")) {
      return `${proxyUrl}${url}`;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `${proxyUrl}${url.startsWith("/") ? "" : "/"}${url}`;
    }
    try {
      const parsed = new URL(url);
      const proxyHost = new URL(proxyUrl).host;
      if (parsed.host !== proxyHost) {
        return await insuredUrlForMerchant(url, {
          indexerUrl,
          proxyBase: proxyUrl,
          fetchImpl,
        });
      }
    } catch {
      // not a merchant URL
    }
    return url;
  }

  return {
    address,
    proxyUrl,
    indexerUrl,
    facilitatorUrl,

    async fetch(input, init) {
      const url = typeof input === "string" ? input : input.toString();
      const insuredInit = withAgentHeaders(init);
      const target = await toInsuredTarget(url);
      const res = await payOnce(target, insuredInit);
      emitFromResponse(target, res);
      return res;
    },

    async resolveMerchant(origin) {
      const r = await resolveMerchant(origin, {
        indexerUrl,
        proxyBase: proxyUrl,
        fetchImpl,
      });
      return {
        slug: r.slug,
        hostname: r.hostname,
        insuredUrl: r.insuredUrl,
        apiPriceMicroUsdc: r.apiPriceMicroUsdc,
        flatPremiumMicroAlgos: r.flatPremiumMicroAlgos,
      };
    },

    async pay(input, init) {
      const url = typeof input === "string" ? input : input.toString();
      const res = await payOnce(url, init);
      emitFromResponse(url, res);
      return res;
    },

    async setup(optsSetup) {
      const micro = optsSetup?.escrowMicroAlgos ?? 3_000_000n;
      return escrowDeposit(micro);
    },

    async topUp(microAlgos) {
      return escrowDeposit(microAlgos);
    },

    on(event, handler) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
      return () => set!.delete(handler);
    },

    async getCall(callId) {
      const res = await fetchImpl(
        `${indexerUrl}/api/calls/${encodeURIComponent(callId)}`,
      );
      return res.json();
    },

    async getAgent(addr) {
      const agent = (addr ?? address).trim();
      const res = await fetchImpl(
        `${indexerUrl}/api/agents/${encodeURIComponent(agent)}`,
      );
      return res.json();
    },

    async getBalance() {
      return indexerUsdcBalanceMicro(address, { fetchImpl });
    },

    async close() {
      // no persistent connection
    },
  };
}
