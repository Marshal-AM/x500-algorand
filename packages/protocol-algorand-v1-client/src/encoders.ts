import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ABIContract, ABIType, ABIUintType } from "algosdk";

export const PACKAGE_NAME = "x500-protocol-algorand-v1-client" as const;
export const ALGORAND_TESTNET = "algorand:testnet" as const;

export const SETTLER_ROLE = BigInt(
  "0x9f2ddfacc8e8d3c8b0000000000000000",
);

/** Encode a UTF-8 slug into bytes16 (right-padded with zeros). */
export function encodeSlug(slug: string): Uint8Array {
  if (slug.length === 0 || slug.length > 16) {
    throw new Error(`slug must be 1–16 chars, got "${slug}"`);
  }
  const buf = Buffer.alloc(16, 0);
  Buffer.from(slug, "utf8").copy(buf);
  return buf;
}

/** Box name for registry slugAt(uint64) map (key prefix `idx`). */
export function encodeSlugIndexBox(index: number): Uint8Array {
  const buf = Buffer.alloc(8, 0);
  buf.writeBigUInt64BE(BigInt(index), 0);
  return Uint8Array.from([...Buffer.from("idx"), ...buf]);
}

/** UUID or hex string → bytes16 (first 16 bytes). */
export function encodeCallId(callId: string): Uint8Array {
  const cleaned = callId.replace(/-/g, "").replace(/^0x/, "");
  const hex = cleaned.padEnd(32, "0").slice(0, 32);
  return Buffer.from(hex, "hex");
}

export interface DeployedApp {
  appId: number;
  address: string;
}

export interface TestnetDeployments {
  network: typeof ALGORAND_TESTNET;
  deployedAt?: string;
  authorityAddress: string;
  registry: DeployedApp;
  pool: DeployedApp;
  settler: DeployedApp;
}

export function loadDeployments(
  path = join(process.cwd(), "config", "deployments.algorand.testnet.json"),
): TestnetDeployments {
  if (!existsSync(path)) {
    throw new Error(
      `Missing deployments file ${path}. Run pnpm protocol:deploy first.`,
    );
  }
  const d = JSON.parse(readFileSync(path, "utf8")) as TestnetDeployments;
  if (d.network !== ALGORAND_TESTNET) {
    throw new Error(
      `deployments.network must be ${ALGORAND_TESTNET}, got ${d.network}`,
    );
  }
  return d;
}

export interface DecodedEndpointConfig {
  registered: boolean;
  paused: boolean;
  owner: string;
  flatPremiumMicroAlgos: bigint;
  percentBps: number;
  slaLatencyMs: number;
  imputedCostMicroAlgos: bigint;
  apiPriceMicroUsdc: bigint;
  feeRecipientCount: number;
  hostname: string;
  contactAddress: string;
}

export interface SettleBatchCallInput {
  callId: string;
  agentAddress: string;
  endpointSlug: string;
  premiumMicroAlgos: bigint;
  refundMicroAlgos: bigint;
  latencyMs: number;
  breach: boolean;
  feeRecipientCountHint: number;
  timestampSec: bigint;
}

function registryAbi(): ABIContract {
  return new ABIContract({
    name: "X500Registry",
    methods: [
      {
        name: "register_endpoint",
        args: [
          { type: "uint8[16]", name: "slug" },
          { type: "string", name: "hostname" },
          { type: "uint64", name: "api_price_micro_usdc" },
          { type: "address", name: "contact_address" },
          { type: "uint32", name: "sla_latency_ms" },
        ],
        returns: { type: "void" },
      },
      {
        name: "get_endpoint",
        args: [{ type: "uint8[16]", name: "slug" }],
        returns: {
          type: "(bool,bool,address,uint64,uint16,uint32,uint64,uint64,uint8,string,address)",
        },
      },
      {
        name: "slug_count",
        args: [],
        returns: { type: "uint64" },
      },
      {
        name: "slug_at",
        args: [{ type: "uint64", name: "index" }],
        returns: { type: "uint8[16]" },
      },
      {
        name: "protocol_paused",
        args: [],
        returns: { type: "bool" },
      },
      {
        name: "set_endpoint_sla",
        args: [
          { type: "uint8[16]", name: "slug" },
          { type: "uint32", name: "sla_latency_ms" },
        ],
        returns: { type: "void" },
      },
      {
        name: "update_endpoint",
        args: [
          { type: "uint8[16]", name: "slug" },
          { type: "string", name: "hostname" },
          { type: "uint64", name: "api_price_micro_usdc" },
          { type: "address", name: "contact_address" },
        ],
        returns: { type: "void" },
      },
    ],
  });
}

function settlerAbi(): ABIContract {
  return new ABIContract({
    name: "X500Settler",
    methods: [
      {
        name: "settle_batch",
        args: [
          {
            type: "(uint8[16],address,uint8[16],uint64,uint64,uint32,bool,uint8,uint64)[]",
            name: "calls",
          },
        ],
        returns: { type: "void" },
      },
      {
        name: "is_settled",
        args: [{ type: "uint8[16]", name: "call_id" }],
        returns: { type: "bool" },
      },
    ],
  });
}

/** PuYa ARC-4 apps expect selector + each arg as separate application args. */
function encodeMethodArgs(
  methodName: string,
  abi: ABIContract,
  values: unknown[],
): Uint8Array[] {
  const method = abi.getMethodByName(methodName);
  const appArgs: Uint8Array[] = [Uint8Array.from(method.getSelector())];
  const args = method.args;
  for (let i = 0; i < values.length; i++) {
    const argType = args[i]?.type;
    if (!argType || typeof argType === "string") {
      throw new Error(`unsupported ABI arg type at index ${i}`);
    }
    const encoded = (argType as ABIType).encode(values[i] as never);
    appArgs.push(Uint8Array.from(encoded));
  }
  return appArgs;
}

function encodeMethodSelector(methodName: string, abi: ABIContract): Uint8Array[] {
  return [Uint8Array.from(abi.getMethodByName(methodName).getSelector())];
}

export function encodeRegisterEndpoint(params: {
  slug: string;
  hostname: string;
  apiPriceMicroUsdc: bigint;
  contactAddress: string;
  slaLatencyMs?: number;
}): Uint8Array[] {
  return encodeMethodArgs("register_endpoint", registryAbi(), [
    encodeSlug(params.slug),
    params.hostname,
    params.apiPriceMicroUsdc,
    params.contactAddress,
    params.slaLatencyMs ?? 0,
  ]);
}

export function encodeGetEndpoint(slug: string): Uint8Array[] {
  return encodeMethodArgs("get_endpoint", registryAbi(), [encodeSlug(slug)]);
}

export function encodeSlugCount(): Uint8Array[] {
  return encodeMethodSelector("slug_count", registryAbi());
}

export function encodeSlugAt(index: number): Uint8Array[] {
  return encodeMethodArgs("slug_at", registryAbi(), [index]);
}

export function encodeProtocolPaused(): Uint8Array[] {
  return encodeMethodSelector("protocol_paused", registryAbi());
}

export function encodeIsSettled(callId: string): Uint8Array[] {
  return encodeMethodArgs("is_settled", settlerAbi(), [encodeCallId(callId)]);
}

export function encodeDepositEscrow(): Uint8Array[] {
  return encodeMethodSelector("deposit_escrow", poolAbi());
}

export function encodeEscrowOf(agentAddress: string): Uint8Array[] {
  return encodeMethodArgs("escrow_of", poolAbi(), [agentAddress]);
}

export function encodeOptInUsdc(): Uint8Array[] {
  return encodeMethodSelector("opt_in_usdc", poolAbi());
}

export function encodeTopUp(slug: string): Uint8Array[] {
  return encodeMethodArgs("top_up", poolAbi(), [encodeSlug(slug)]);
}

export function encodeSetEndpointSla(slug: string, slaLatencyMs: number): Uint8Array[] {
  return encodeMethodArgs("set_endpoint_sla", registryAbi(), [
    encodeSlug(slug),
    slaLatencyMs,
  ]);
}

export function encodeUpdateEndpoint(params: {
  slug: string;
  hostname: string;
  apiPriceMicroUsdc: bigint;
  contactAddress: string;
}): Uint8Array[] {
  return encodeMethodArgs("update_endpoint", registryAbi(), [
    encodeSlug(params.slug),
    params.hostname,
    params.apiPriceMicroUsdc,
    params.contactAddress,
  ]);
}

function poolAbi(): ABIContract {
  return new ABIContract({
    name: "X500Pool",
    methods: [
      {
        name: "init",
        args: [{ type: "uint64", name: "settler_app_id" }],
        returns: { type: "void" },
      },
      {
        name: "opt_in_usdc",
        args: [],
        returns: { type: "void" },
      },
      {
        name: "top_up",
        args: [{ type: "uint8[16]", name: "slug" }],
        returns: { type: "void" },
      },
      {
        name: "deposit_escrow",
        args: [],
        returns: { type: "void" },
      },
      {
        name: "escrow_of",
        args: [{ type: "address", name: "agent" }],
        returns: { type: "uint64" },
      },
      {
        name: "balance_of",
        args: [{ type: "uint8[16]", name: "slug" }],
        returns: { type: "(uint64,uint64)" },
      },
    ],
  });
}

function settlerInitAbi(): ABIContract {
  return new ABIContract({
    name: "X500Settler",
    methods: [
      {
        name: "init",
        args: [
          { type: "uint64", name: "pool_app_id" },
          { type: "address", name: "authority" },
        ],
        returns: { type: "void" },
      },
    ],
  });
}

export function encodePoolInit(settlerAppId: number): Uint8Array[] {
  return encodeMethodArgs("init", poolAbi(), [settlerAppId]);
}

export function encodeSettlerInit(
  poolAppId: number,
  authorityAddress: string,
): Uint8Array[] {
  return encodeMethodArgs("init", settlerInitAbi(), [
    poolAppId,
    authorityAddress,
  ]);
}

export function encodeSettleBatch(calls: SettleBatchCallInput[]): Uint8Array[] {
  const events = calls.map((c) => [
    encodeSlug(c.endpointSlug),
    c.agentAddress,
    encodeCallId(c.callId),
    c.premiumMicroAlgos,
    c.refundMicroAlgos,
    c.latencyMs,
    c.breach,
    c.feeRecipientCountHint,
    c.timestampSec,
  ]);
  return encodeMethodArgs("settle_batch", settlerAbi(), [events]);
}

export function decodeEndpointConfig(raw: Uint8Array | null): DecodedEndpointConfig {
  if (!raw || raw.length === 0) {
    throw new Error("decodeEndpointConfig: empty return");
  }
  const method = registryAbi().getMethodByName("get_endpoint");
  const returnType = method.returns.type;
  if (returnType === "void") {
    throw new Error("decodeEndpointConfig: get_endpoint is not void");
  }
  const decoded = (returnType as ABIType).decode(raw);
  const tuple = decoded as [
    boolean,
    boolean,
    string,
    bigint,
    number,
    number,
    bigint,
    bigint,
    number,
    string,
    string,
  ];
  return {
    registered: Boolean(tuple[0]),
    paused: Boolean(tuple[1]),
    owner: String(tuple[2]),
    flatPremiumMicroAlgos: BigInt(tuple[3]),
    percentBps: Number(tuple[4]),
    slaLatencyMs: Number(tuple[5]),
    imputedCostMicroAlgos: BigInt(tuple[6]),
    apiPriceMicroUsdc: BigInt(tuple[7]),
    feeRecipientCount: Number(tuple[8]),
    hostname: String(tuple[9]),
    contactAddress: String(tuple[10]),
  };
}

export function bytes16ToSlug(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) {
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}
