import algosdk from "algosdk";
import {
  decodeEndpointConfig,
  encodeGetEndpoint,
  encodeIsSettled,
  encodeProtocolPaused,
  encodeSettleBatch,
  encodeSlugAt,
  encodeSlugCount,
  bytes16ToSlug,
  loadDeployments,
  indexerAccountBalanceMicroAlgos,
  indexerSimulateAppCall,
  type TestnetDeployments,
} from "x500-protocol-algorand-v1-client";
import {
  ALGORAND_TESTNET_CHAIN,
  Phase2RequiredError,
  USDC_TESTNET_ASA_ID,
  type AgentEligibility,
  type ChainAdapter,
  type ChainDescriptor,
  type EndpointConfigSnapshot,
  type SettleBatchInput,
  type SettleBatchResult,
} from "./types.js";
import { resolveDeploymentsPath } from "./deployments-path.js";

export interface AlgorandAdapterOptions {
  indexerUrl?: string;
  algodUrl?: string;
  fetchImpl?: typeof fetch;
  deploymentsPath?: string;
  settlerMnemonic?: string;
  deployments?: TestnetDeployments;
}

/**
 * Algorand-only adapter.
 *
 * - Balances: indexer REST (free)
 * - Endpoint reads: indexer simulate (free)
 * - settleBatch: paid on-chain app call via settler wallet
 */
export class AlgorandAdapter implements ChainAdapter {
  readonly chain: ChainDescriptor;
  private readonly fetchImpl: typeof fetch;
  private readonly deploymentsPath?: string;
  private readonly settlerMnemonic?: string;
  private cachedDeployments: TestnetDeployments | null | undefined;

  constructor(opts: AlgorandAdapterOptions = {}) {
    this.chain = {
      ...ALGORAND_TESTNET_CHAIN,
      indexerUrl:
        opts.indexerUrl ??
        process.env.ALGORAND_INDEXER_URL?.trim() ??
        ALGORAND_TESTNET_CHAIN.indexerUrl,
      algodUrl:
        opts.algodUrl ??
        process.env.ALGORAND_ALGOD_URL?.trim() ??
        ALGORAND_TESTNET_CHAIN.algodUrl,
    };
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.deploymentsPath = opts.deploymentsPath;
    this.settlerMnemonic = opts.settlerMnemonic;
    if (opts.deployments) this.cachedDeployments = opts.deployments;
  }

  private requireDeployments(): TestnetDeployments {
    if (this.cachedDeployments !== undefined) {
      if (this.cachedDeployments === null) {
        throw new Phase2RequiredError("deployments");
      }
      return this.cachedDeployments;
    }
    try {
      const path = resolveDeploymentsPath(this.deploymentsPath);
      this.cachedDeployments = loadDeployments(path);
      return this.cachedDeployments;
    } catch {
      this.cachedDeployments = null;
      throw new Phase2RequiredError("deployments");
    }
  }

  async readEndpointConfigs(): Promise<ReadonlyArray<EndpointConfigSnapshot>> {
    const d = this.requireDeployments();
    const countRaw = await this.simulate(
      d.registry.appId,
      encodeSlugCount(),
      "uint64",
    );
    const count = Number(countRaw ?? 0);
    const out: EndpointConfigSnapshot[] = [];
    for (let i = 0; i < count; i++) {
      const slugBytes = await this.simulate(
        d.registry.appId,
        encodeSlugAt(i),
        "bytes",
      );
      if (!slugBytes) continue;
      const slug = bytes16ToSlug(slugBytes as Uint8Array);
      const ep = await this.getEndpoint(slug);
      if (ep) out.push(ep);
    }
    return out;
  }

  async getEndpoint(slug: string): Promise<EndpointConfigSnapshot | null> {
    const d = this.requireDeployments();
    try {
      const raw = await indexerSimulateAppCall(
        d.registry.appId,
        encodeGetEndpoint(slug),
        {
          algodUrl: this.chain.algodUrl,
          fetchImpl: this.fetchImpl,
          boxes: [{ app: d.registry.appId, name: encodeSlug(slug) }],
        },
      );
      const ep = decodeEndpointConfig(raw);
      if (!ep.registered) return null;
      return {
        slug,
        authorityAddress: d.authorityAddress,
        ownerAddress: ep.owner,
        paused: ep.paused,
        slaLatencyMs: ep.slaLatencyMs,
        flatPremiumMicroAlgos: ep.flatPremiumMicroAlgos,
        imputedCostMicroAlgos: ep.imputedCostMicroAlgos,
        apiPriceMicroUsdc: ep.apiPriceMicroUsdc,
        hostname: ep.hostname,
        contactAddress: ep.contactAddress,
        raw: ep,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("not found") ||
        msg.includes("rejected") ||
        msg.includes("empty return")
      ) {
        return null;
      }
      throw err;
    }
  }

  async isCallSettled(callId: string): Promise<boolean> {
    const d = this.requireDeployments();
    const raw = await indexerSimulateAppCall(
      d.settler.appId,
      encodeIsSettled(callId),
      {
        algodUrl: this.chain.algodUrl,
        fetchImpl: this.fetchImpl,
        boxes: [{ app: d.settler.appId, name: settlerCallBoxName(callId) }],
      },
    );
    if (!raw || raw.length === 0) return false;
    return raw[0] === 1;
  }

  async getProtocolPaused(): Promise<boolean> {
    const d = this.requireDeployments();
    const raw = await this.simulate(
      d.registry.appId,
      encodeProtocolPaused(),
      "bool",
    );
    return Boolean(raw);
  }

  async submitSettleBatch(input: SettleBatchInput): Promise<SettleBatchResult> {
    const d = this.requireDeployments();
    const mnemonic =
      this.settlerMnemonic ?? process.env.ALGORAND_SETTLER_MNEMONIC?.trim();
    if (!mnemonic) {
      throw new Error(
        "submitSettleBatch requires ALGORAND_SETTLER_MNEMONIC",
      );
    }

    const account = algosdk.mnemonicToSecretKey(mnemonic);
    const algod = new algosdk.Algodv2(
      "",
      this.chain.algodUrl,
      "",
    );

    const calls = input.calls.map((c) => ({
      callId: c.callId,
      agentAddress: c.agentAddress,
      endpointSlug: input.slug,
      premiumMicroAlgos: c.premiumMicroAlgos,
      refundMicroAlgos: c.refundMicroAlgos,
      latencyMs: c.latencyMs,
      breach: c.outcome === "breach",
      feeRecipientCountHint: 1,
      timestampSec: BigInt(Math.floor(Date.now() / 1000)),
    }));

    const boxes: algosdk.BoxReference[] = [];
    const slugBytes = encodeSlug(input.slug);
    for (const c of calls) {
      boxes.push({
        appIndex: d.settler.appId,
        name: settlerCallBoxName(c.callId),
      });
      boxes.push({
        appIndex: d.pool.appId,
        name: slugBytes,
      });
      boxes.push({
        appIndex: d.pool.appId,
        name: poolEscrowBoxName(c.agentAddress),
      });
    }

    const appArgs = encodeSettleBatch(calls);
    // Inner USDC refunds require agent accounts in the txn accounts array.
    const refundAgents = [
      ...new Set(
        input.calls
          .filter(
            (c) =>
              c.outcome === "breach" &&
              c.refundMicroAlgos > 0n,
          )
          .map((c) => c.agentAddress),
      ),
    ];
    const suggestedParams = await algod.getTransactionParams().do();
    const txn = algosdk.makeApplicationCallTxnFromObject({
      sender: account.addr,
      appIndex: d.settler.appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs,
      accounts: refundAgents,
      foreignApps: [d.pool.appId],
      foreignAssets: [Number(USDC_TESTNET_ASA_ID)],
      boxes,
      suggestedParams: {
        ...suggestedParams,
        fee:
          Number(suggestedParams.fee ?? 1000) +
          2000 +
          refundAgents.length * 1000,
        flatFee: true,
      },
    });
    const signed = txn.signTxn(account.sk);
    const { txid } = await algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algod, txid, 4);
    return { transactionId: txid };
  }

  async getNativeAlgoBalance(address: string): Promise<bigint> {
    return indexerAccountBalanceMicroAlgos(address, {
      indexerUrl: this.chain.indexerUrl,
      fetchImpl: this.fetchImpl,
    });
  }

  async checkAgentEligibility(
    address: string,
    premiumMicroAlgos: bigint,
  ): Promise<AgentEligibility> {
    const d = this.requireDeployments();
    const escrowMicroAlgos = await this.readPoolEscrowMicro(
      d.pool.appId,
      address,
    );
    if (escrowMicroAlgos < premiumMicroAlgos) {
      return {
        eligible: false,
        mode: "balance_gte_premium_weak",
        algoMicroAlgos: escrowMicroAlgos,
        requiredMicroAlgos: premiumMicroAlgos,
        reason: "insufficient_balance",
      };
    }
    return {
      eligible: true,
      mode: "balance_gte_premium_weak",
      algoMicroAlgos: escrowMicroAlgos,
      requiredMicroAlgos: premiumMicroAlgos,
    };
  }

  /** Read agent escrow from pool box (more reliable than simulate for escrow_of). */
  private async readPoolEscrowMicro(
    poolAppId: number,
    agentAddress: string,
  ): Promise<bigint> {
    const algod = new algosdk.Algodv2("", this.chain.algodUrl, "");
    const boxName = poolEscrowBoxName(agentAddress);
    try {
      const box = await algod.getApplicationBoxByName(poolAppId, boxName).do();
      const buf = Buffer.from(box.value);
      if (buf.length < 8) return 0n;
      return buf.readBigUInt64BE(buf.length - 8);
    } catch {
      return 0n;
    }
  }

  async indexerAccountExists(address: string): Promise<boolean> {
    const url = `${this.chain.indexerUrl}/v2/accounts/${address}`;
    const res = await this.fetchImpl(url);
    return res.status === 200;
  }

  private async simulate(
    appId: number,
    appArgs: Uint8Array[],
    kind: "uint64" | "bool" | "bytes",
  ): Promise<unknown> {
    const raw = await indexerSimulateAppCall(appId, appArgs, {
      algodUrl: this.chain.algodUrl,
      fetchImpl: this.fetchImpl,
    });
    if (!raw) return kind === "uint64" ? 0 : kind === "bool" ? false : null;
    if (kind === "uint64") {
      const buf = Buffer.from(raw);
      return buf.readBigUInt64BE(buf.length - 8);
    }
    if (kind === "bool") return raw[0] === 1;
    return raw;
  }
}

function encodeSlug(slug: string): Uint8Array {
  const buf = Buffer.alloc(16, 0);
  Buffer.from(slug, "utf8").copy(buf);
  return buf;
}

function encodeCallId(callId: string): Uint8Array {
  const cleaned = callId.replace(/-/g, "").replace(/^0x/, "");
  const hex = cleaned.padEnd(32, "0").slice(0, 32);
  return Buffer.from(hex, "hex");
}

function settlerCallBoxName(callId: string): Uint8Array {
  return Uint8Array.from([...Buffer.from("s"), ...encodeCallId(callId)]);
}

function poolEscrowBoxName(agentAddress: string): Uint8Array {
  const pk = algosdk.decodeAddress(agentAddress).publicKey;
  return Uint8Array.from([...Buffer.from("e"), ...pk]);
}
