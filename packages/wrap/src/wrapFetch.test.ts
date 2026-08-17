import { describe, expect, it } from "vitest";
import { defaultClassifier } from "./classifier.js";
import { computeEconomics, isCoveredBreach } from "./economics.js";
import { MemoryEventSink, SupabaseEventSink } from "./eventSink.js";
import {
  assertAlgorandTestnet,
  assertUsdcAsset,
  USDC_TESTNET_ASA_ID,
} from "./types.js";
import { wrapFetch } from "./wrapFetch.js";

const endpointConfig = {
  slug: "dummy",
  sla_latency_ms: 100,
  flat_premium_micro_algos: 1_000_000n,
  imputed_cost_micro_algos: 10_000_000n,
};

describe("computeEconomics", () => {
  it("charges flat premium on ok with zero refund", () => {
    const e = computeEconomics({
      outcome: "ok",
      pool: {
        flatPremiumMicroAlgos: 1n,
        imputedCostMicroAlgos: 10n,
      },
    });
    expect(e.premiumMicroAlgos).toBe(1n);
    expect(e.refundMicroAlgos).toBe(0n);
    expect(e.covered).toBe(true);
  });

  it("refunds principal+premium on covered breach", () => {
    expect(isCoveredBreach("server_error")).toBe(true);
    const e = computeEconomics({
      outcome: "server_error",
      pool: {
        flatPremiumMicroAlgos: 1n,
        imputedCostMicroAlgos: 10n,
      },
    });
    expect(e.refundMicroAlgos).toBe(11n);
  });

  it("zero on client_error", () => {
    const e = computeEconomics({
      outcome: "client_error",
      pool: {
        flatPremiumMicroAlgos: 1n,
        imputedCostMicroAlgos: 10n,
      },
    });
    expect(e.premiumMicroAlgos).toBe(0n);
    expect(e.refundMicroAlgos).toBe(0n);
    expect(e.covered).toBe(false);
  });
});

describe("assertUsdcAsset", () => {
  it("rejects non-USDC asset", () => {
    expect(() => assertUsdcAsset("algo")).toThrow(/USDC/);
  });
});

describe("assertAlgorandTestnet", () => {
  it("rejects other networks", () => {
    expect(() => assertAlgorandTestnet("other:testnet")).toThrow(
      /algorand:testnet/,
    );
  });
});

describe("SupabaseEventSink", () => {
  it("requires client or env credentials", () => {
    const prevUrl = process.env.ALGORAND_SUPABASE_URL;
    const prevKey = process.env.ALGORAND_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ALGORAND_SUPABASE_URL;
    delete process.env.ALGORAND_SUPABASE_SERVICE_ROLE_KEY;
    try {
      expect(() => new SupabaseEventSink()).toThrow(/ALGORAND_SUPABASE_URL/);
    } finally {
      if (prevUrl !== undefined) process.env.ALGORAND_SUPABASE_URL = prevUrl;
      if (prevKey !== undefined)
        process.env.ALGORAND_SUPABASE_SERVICE_ROLE_KEY = prevKey;
    }
  });

  it("inserts settle_jobs via client", async () => {
    const inserts: Record<string, unknown>[] = [];
    const sink = new SupabaseEventSink({
      client: {
        from: () => ({
          insert: async (row: Record<string, unknown>) => {
            inserts.push(row);
            return { error: null };
          },
          update: () => ({
            eq: async () => ({ error: null }),
          }),
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        rpc: async () => ({ data: [], error: null }),
      },
    });
    await sink.publish({
      callId: "call-1",
      agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      endpointSlug: "dummy",
      premiumMicroAlgos: "1000000",
      refundMicroAlgos: "0",
      latencyMs: 10,
      outcome: "ok",
      ts: new Date().toISOString(),
      network: "algorand:testnet",
      asset: "algo",
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.call_id).toBe("call-1");
    expect(inserts[0]?.status).toBe("pending");
  });

  it("publishes settle job without error", async () => {
    const sink = new SupabaseEventSink({
      client: {
        from: () => ({
          insert: async () => ({ error: null }),
          update: () => ({ eq: async () => ({ error: null }) }),
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        rpc: async () => ({ data: [], error: null }),
      },
    });
    await sink.publish({
      callId: "x2",
      agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      endpointSlug: "dummy",
      premiumMicroAlgos: "1",
      refundMicroAlgos: "0",
      latencyMs: 0,
      outcome: "ok",
      ts: new Date().toISOString(),
      network: "algorand:testnet",
      asset: "algo",
    });
  });
});

describe("wrapFetch", () => {
  it("classifies 500 as server_error with refund event", async () => {
    const sink = new MemoryEventSink();
    const result = await wrapFetch({
      endpointSlug: "dummy",
      agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      upstreamUrl: "https://example.invalid/x",
      endpointConfig,
      classifier: defaultClassifier,
      sink,
      fetchImpl: async () => new Response("err", { status: 500 }),
    });

    expect(result.outcome).toBe("server_error");
    expect(result.premiumMicroAlgos).toBe(
      endpointConfig.flat_premium_micro_algos,
    );
    expect(result.refundMicroAlgos).toBe(
      endpointConfig.imputed_cost_micro_algos +
        endpointConfig.flat_premium_micro_algos,
    );
    await Promise.resolve();
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]?.network).toBe("algorand:testnet");
    expect(sink.events[0]?.asset).toBe("algo");
    expect(sink.events[0]?.outcome).toBe("server_error");
  });

  it("classifies thrown fetch as network_error", async () => {
    const sink = new MemoryEventSink();
    const result = await wrapFetch({
      endpointSlug: "dummy",
      agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      upstreamUrl: "https://example.invalid/x",
      endpointConfig,
      classifier: defaultClassifier,
      sink,
      fetchImpl: async () => {
        throw new Error("boom");
      },
    });
    expect(result.outcome).toBe("network_error");
    expect(result.response.status).toBe(502);
  });

  it("marks slow 2xx as latency_breach", async () => {
    const sink = new MemoryEventSink();
    let t = 0;
    const result = await wrapFetch({
      endpointSlug: "dummy",
      agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      upstreamUrl: "https://example.invalid/x",
      endpointConfig,
      classifier: defaultClassifier,
      sink,
      now: () => {
        const cur = t;
        t += 200;
        return cur;
      },
      fetchImpl: async () => new Response("ok", { status: 200 }),
    });
    expect(result.outcome).toBe("latency_breach");
    expect(result.latencyMs).toBe(200);
  });

  it("rejects wrong network", async () => {
    await expect(
      wrapFetch({
        endpointSlug: "dummy",
        agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        upstreamUrl: "https://example.invalid",
        endpointConfig,
        classifier: defaultClassifier,
        sink: new MemoryEventSink(),
        network: "other:testnet",
        fetchImpl: async () => new Response("ok"),
      }),
    ).rejects.toThrow(/algorand:testnet/);
  });

  it("allows USDC asset on response headers (x402 layer)", async () => {
    const result = await wrapFetch({
      endpointSlug: "dummy",
      agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      upstreamUrl: "https://example.invalid",
      endpointConfig,
      classifier: defaultClassifier,
      sink: new MemoryEventSink(),
      asset: USDC_TESTNET_ASA_ID,
      fetchImpl: async () => new Response("ok"),
    });
    expect(result.response.headers.get("x-x500-asset")).toBe(
      USDC_TESTNET_ASA_ID,
    );
  });
});
