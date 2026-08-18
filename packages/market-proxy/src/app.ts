import { serve } from "@hono/node-server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Hono, type Context } from "hono";
import WebSocket from "ws";
import { requireAlgorandSupabaseConfig } from "@x500/db-algorand";
import { AlgorandAdapter } from "@x500/shared";
import { USDC_TESTNET_ASA_ID, ALGORAND_TESTNET } from "@x500/wrap";
import {
  defaultClassifier,
  SupabaseEventSink,
  wrapFetch,
  pushIndexerEvent,
  pendingIndexerBody,
  type BalanceCheck,
  type EndpointConfig,
} from "@x500/wrap";

export const PACKAGE_NAME = "@x500/market-proxy" as const;

const AGENT_HEADER = "x-x500-agent-address";
const BETA_HEADER = "x-x500-beta-key";

function forwardUpstreamHeaders(
  c: Context,
  method: string,
  body?: ArrayBuffer,
): RequestInit {
  const headers = new Headers();
  const skip = new Set([
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "upgrade",
    AGENT_HEADER.toLowerCase(),
    BETA_HEADER.toLowerCase(),
  ]);
  c.req.raw.headers.forEach((value, name) => {
    if (skip.has(name.toLowerCase())) return;
    headers.append(name, value);
  });
  const init: RequestInit = { method, headers };
  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = body;
  }
  return init;
}

function endpointPremiumMicroAlgos(
  dbValue: number | null | undefined,
  chainValue: bigint,
): bigint {
  if (dbValue != null && dbValue > 0) return BigInt(dbValue);
  if (chainValue > 0n) return chainValue;
  return 1_000_000n;
}

function requireBootEnv(): {
  dummyUpstreamFallback: string;
  indexerUrl: string;
  indexerPushSecret: string | null;
  betaKey: string | null;
  awaitSink: boolean;
} {
  if (process.env.ALGORAND_NETWORK?.trim() !== ALGORAND_TESTNET) {
    throw new Error(
      `market-proxy refuses boot: ALGORAND_NETWORK must be ${ALGORAND_TESTNET}`,
    );
  }
  const dummyUpstreamFallback = (
    process.env.DUMMY_UPSTREAM_URL ?? "http://127.0.0.1:8790"
  )
    .trim()
    .replace(/\/$/, "");
  const indexerUrl = (process.env.INDEXER_URL ?? "http://127.0.0.1:8787")
    .trim()
    .replace(/\/$/, "");
  const { url, serviceRoleKey: key } = requireAlgorandSupabaseConfig();
  if (!url || !key) {
    throw new Error(
      "market-proxy requires ALGORAND_SUPABASE_URL + ALGORAND_SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return {
    dummyUpstreamFallback,
    indexerUrl,
    indexerPushSecret: process.env.INDEXER_PUSH_SECRET?.trim() || null,
    betaKey: process.env.MARKET_PROXY_BETA_KEY?.trim() || null,
    awaitSink: process.env.X500_AWAIT_SINK === "1",
  };
}

function createSupabase(): SupabaseClient {
  const { url, serviceRoleKey: key } = requireAlgorandSupabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
}

function createAdapter(): AlgorandAdapter {
  return new AlgorandAdapter({
    deploymentsPath: process.env.X500_DEPLOYMENTS_PATH?.trim(),
    settlerMnemonic: process.env.ALGORAND_SETTLER_MNEMONIC?.trim(),
  });
}

type OriginResolve =
  | { ok: true; base: string }
  | { ok: false; error: string; message: string };

export function resolveOriginBase(
  hostname: string | null | undefined,
  slug: string,
  dummyFallback: string,
): OriginResolve {
  let raw = hostname?.trim();
  if (!raw) {
    if (slug === "dummy" && dummyFallback) {
      console.warn(
        `[market-proxy] slug=dummy missing hostname — using DUMMY_UPSTREAM_URL (${dummyFallback})`,
      );
      raw = dummyFallback;
    } else {
      return {
        ok: false,
        error: "missing_origin",
        message: `Endpoint ${slug} has no hostname configured`,
      };
    }
  }
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    return {
      ok: false,
      error: "hostname_must_include_scheme",
      message:
        "hostname must be an absolute URL starting with http:// or https://",
    };
  }
  return { ok: true, base: raw.replace(/\/$/, "") };
}

export function createMarketProxyApp(opts?: {
  supabase?: SupabaseClient;
  adapter?: AlgorandAdapter;
  sink?: SupabaseEventSink;
}): Hono {
  const boot = requireBootEnv();
  const supabase = opts?.supabase ?? createSupabase();
  const adapter = opts?.adapter ?? createAdapter();
  const sink = opts?.sink ?? new SupabaseEventSink({ client: supabase });
  const app = new Hono();

  const balanceCheck: BalanceCheck = {
    async check(agentAddress, requiredMicroAlgos) {
      const e = await adapter.checkAgentEligibility(
        agentAddress,
        requiredMicroAlgos,
      );
      if (!e.eligible) {
        return {
          eligible: false,
          reason: "insufficient_balance",
          algoMicroAlgos: e.algoMicroAlgos,
        };
      }
      return { eligible: true, algoMicroAlgos: e.algoMicroAlgos };
    },
  };

  app.get("/health", (c) =>
    c.json({ ok: true, service: "market-proxy", network: ALGORAND_TESTNET }),
  );

  app.get("/.well-known/endpoints", async (c) => {
    const { data, error } = await supabase
      .from("endpoints")
      .select(
        "slug,hostname,sla_ms,flat_premium_micro_algos,imputed_cost_micro_algos,api_price_micro_usdc,paused",
      )
      .order("slug");
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    const endpoints = (data ?? []).map((row) => ({
      slug: row.slug,
      hostname: row.hostname,
      slaMs: row.sla_ms,
      flatPremiumMicroAlgos: String(row.flat_premium_micro_algos),
      imputedCostMicroAlgos: String(row.imputed_cost_micro_algos),
      apiPriceMicroUsdc: String(row.api_price_micro_usdc ?? 5000),
      paused: row.paused,
      asset: USDC_TESTNET_ASA_ID,
      network: ALGORAND_TESTNET,
    }));
    return c.json({ cacheTtlSec: 60, endpoints });
  });

  app.get("/v1/agents/:address", async (c) => {
    const address = c.req.param("address");
    const res = await fetch(
      `${boot.indexerUrl}/api/agents/${encodeURIComponent(address)}`,
    );
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    });
  });

  app.get("/v1/calls/:id", async (c) => {
    const id = c.req.param("id");
    const res = await fetch(
      `${boot.indexerUrl}/api/calls/${encodeURIComponent(id)}`,
    );
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    });
  });

  app.all("/v1/:slug/*", async (c) => {
    const slug = c.req.param("slug");

    const chainEp = await adapter.getEndpoint(slug).catch(() => null);
    const dbOnly = process.env.X500_PROXY_DB_ONLY === "1";
    if (!chainEp && !dbOnly) {
      return c.json(
        {
          error: "unknown_slug",
          slug,
          message: "Endpoint not registered on-chain",
        },
        404,
      );
    }
    if (chainEp?.paused) {
      return c.json({ error: "endpoint_paused", slug }, 503);
    }

    let protocolPaused = false;
    if (chainEp) {
      try {
        protocolPaused = await adapter.getProtocolPaused();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return c.json({ error: "protocol_state_unavailable", message: msg }, 503);
      }
    }
    if (protocolPaused) {
      return c.json({ error: "protocol_paused" }, 503);
    }

    const { data: dbEp, error: dbErr } = await supabase
      .from("endpoints")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (dbErr) {
      return c.json({ error: dbErr.message }, 500);
    }
    if (!dbEp) {
      return c.json(
        {
          error: "endpoint_not_in_db",
          slug,
          message: "Register endpoint in Supabase after on-chain register",
        },
        404,
      );
    }
    if (dbEp.paused) {
      return c.json({ error: "endpoint_paused", slug }, 503);
    }

    const origin = resolveOriginBase(
      dbEp.hostname,
      slug,
      boot.dummyUpstreamFallback,
    );
    if (!origin.ok) {
      return c.json(
        { error: origin.error, slug, message: origin.message },
        503,
      );
    }

    const rest = c.req.path.replace(new RegExp(`^/v1/${slug}/?`), "") || "";
    const qs = c.req.url.includes("?")
      ? c.req.url.slice(c.req.url.indexOf("?"))
      : "";
    const upstreamUrl = `${origin.base}/${rest}${qs}`;

    const slaFromChain = chainEp?.slaLatencyMs ?? 0;
    const endpointConfig: EndpointConfig = {
      slug,
      sla_latency_ms:
        dbEp.sla_ms > 0
          ? dbEp.sla_ms
          : slaFromChain > 0
            ? slaFromChain
            : 60_000,
      flat_premium_micro_algos: endpointPremiumMicroAlgos(
        dbEp.flat_premium_micro_algos,
        chainEp?.flatPremiumMicroAlgos ?? 0n,
      ),
      imputed_cost_micro_algos: endpointPremiumMicroAlgos(
        dbEp.imputed_cost_micro_algos,
        chainEp?.imputedCostMicroAlgos ?? 0n,
      ),
      api_price_micro_usdc: BigInt(
        dbEp.api_price_micro_usdc ?? chainEp?.apiPriceMicroUsdc ?? 5000,
      ),
    };

    const agentAddress = c.req.header(AGENT_HEADER)?.trim();
    if (!agentAddress) {
      const method = c.req.method;
      const body =
        method !== "GET" && method !== "HEAD"
          ? await c.req.arrayBuffer()
          : undefined;
      const init = forwardUpstreamHeaders(c, method, body);
      const upstream = await fetch(upstreamUrl, init);
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
      });
    }

    if (boot.betaKey) {
      const provided = c.req.header(BETA_HEADER)?.trim();
      if (provided !== boot.betaKey) {
        return c.json({ error: "invalid_beta_key" }, 401);
      }
    }

    const method = c.req.method;
    const body =
      method !== "GET" && method !== "HEAD"
        ? await c.req.arrayBuffer()
        : undefined;
    const init = forwardUpstreamHeaders(c, method, body);

    const result = await wrapFetch({
      endpointSlug: slug,
      agentAddress,
      upstreamUrl,
      init,
      classifier: defaultClassifier,
      sink,
      balanceCheck,
      endpointConfig,
      network: ALGORAND_TESTNET,
      asset: USDC_TESTNET_ASA_ID,
      pool: "x500-pool",
      skipZeroPremium: true,
      awaitSink: boot.awaitSink,
    });
    if (result.response.status >= 400) {
      console.warn(
        `[market-proxy] slug=${slug} upstream=${upstreamUrl} status=${result.response.status} outcome=${result.outcome} latencyMs=${result.latencyMs} premium=${result.premiumMicroAlgos} refund=${result.refundMicroAlgos}`,
      );
    }

    if (
      boot.indexerPushSecret &&
      (result.premiumMicroAlgos > 0n || result.refundMicroAlgos > 0n)
    ) {
      const body = pendingIndexerBody({
        callId: result.callId,
        agentAddress,
        endpointSlug: slug,
        outcome: result.outcome,
        latencyMs: result.latencyMs,
        premiumMicroAlgos: result.premiumMicroAlgos,
        refundMicroAlgos: result.refundMicroAlgos,
        asset: USDC_TESTNET_ASA_ID,
      });
      void pushIndexerEvent({
        indexerUrl: boot.indexerUrl,
        pushSecret: boot.indexerPushSecret,
        body,
      }).catch((err) => {
        console.error(
          "[market-proxy] pending indexer push failed",
          err instanceof Error ? err.message : err,
        );
      });
    }

    return result.response;
  });

  app.onError((err, c) => {
    console.error("[market-proxy]", err);
    return c.json(
      {
        error: "internal",
        message: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  });

  return app;
}

export function startMarketProxy(
  port = Number(process.env.MARKET_PROXY_PORT ?? process.env.PORT ?? 8788),
) {
  const app = createMarketProxyApp();
  return serve({ fetch: app.fetch, port }, () => {
    console.log(`[market-proxy] listening on :${port}`);
  });
}
