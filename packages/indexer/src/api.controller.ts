import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadDeployments } from "@x500/protocol-algorand-v1-client";
import { SupabaseService } from "./supabase.service.js";

@Controller("api")
export class ApiController {
  constructor(@Inject(SupabaseService) private readonly db: SupabaseService) {}

  @Get("config")
  protocolConfig() {
    const path = join(
      process.cwd(),
      "config",
      "deployments.algorand.testnet.json",
    );
    if (!existsSync(path)) {
      return { error: "deployments not configured" };
    }
    const d = loadDeployments(path);
    return {
      network: d.network,
      registryAppId: d.registry.appId,
      poolAppId: d.pool.appId,
      settlerAppId: d.settler.appId,
    };
  }

  @Get("endpoints")
  async endpoints() {
    const { data, error } = await this.db.client
      .from("endpoints")
      .select("*")
      .order("slug");
    if (error) return { error: error.message };
    return { endpoints: data };
  }

  @Get("endpoints/resolve")
  async resolveEndpoint(@Query("origin") origin?: string) {
    if (!origin?.trim()) {
      return { error: "origin query param required (absolute http(s) URL)" };
    }
    const trimmed = origin.trim();
    const withScheme =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    let normalized: string;
    try {
      const url = new URL(withScheme);
      normalized = `${url.protocol}//${url.host}`.replace(/\/$/, "");
    } catch {
      return { error: "invalid origin URL" };
    }

    const { data, error } = await this.db.client
      .from("endpoints")
      .select(
        "slug, hostname, sla_ms, flat_premium_micro_algos, api_price_micro_usdc, imputed_cost_micro_algos, contact_address, paused",
      )
      .eq("hostname", normalized)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data) {
      return {
        error: `no endpoint registered for origin ${normalized}`,
        origin: normalized,
      };
    }

    const proxyBase = (
      process.env.MARKET_PROXY_URL?.trim() || "http://127.0.0.1:8788"
    ).replace(/\/$/, "");

    return {
      origin: normalized,
      endpoint: data,
      insuredBaseUrl: `${proxyBase}/v1/${data.slug}/`,
    };
  }

  @Get("endpoints/:slug")
  async endpoint(@Param("slug") slug: string) {
    const { data, error } = await this.db.client
      .from("endpoints")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return { error: error.message };
    return { endpoint: data };
  }

  @Get("calls")
  async calls(@Query("limit") limit?: string) {
    const lim = Math.min(Number(limit ?? 50), 200);
    const { data, error } = await this.db.client
      .from("calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(lim);
    if (error) return { error: error.message };
    return { calls: data };
  }

  @Get("calls/:id")
  async call(@Param("id") id: string) {
    const { data, error } = await this.db.client
      .from("calls")
      .select("*")
      .eq("call_id", id)
      .maybeSingle();
    if (error) return { error: error.message };
    return { call: data };
  }

  @Get("agents")
  async agents(@Query("limit") limit?: string) {
    const lim = Math.min(Number(limit ?? 100), 500);
    const { data, error } = await this.db.client
      .from("agents")
      .select("*")
      .order("last_call_at", { ascending: false, nullsFirst: false })
      .limit(lim);
    if (error) return { error: error.message };
    return { agents: data };
  }

  @Get("agents/:address")
  async agent(@Param("address") address: string) {
    const { data, error } = await this.db.client
      .from("agents")
      .select("*")
      .eq("address", address)
      .maybeSingle();
    if (error) return { error: error.message };
    return { agent: data };
  }

  @Get("agents/:address/calls")
  async agentCalls(@Param("address") address: string) {
    const { data, error } = await this.db.client
      .from("calls")
      .select("*")
      .eq("agent_address", address)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { error: error.message };
    return { calls: data };
  }

  @Get("pool")
  async pool() {
    const { data, error } = await this.db.client
      .from("pool_state")
      .select("*")
      .order("endpoint_slug");
    if (error) return { error: error.message };
    return { pools: data, network: "algorand:testnet", asset: "algo" };
  }

  @Get("stats")
  async stats() {
    const { data: calls, error } = await this.db.client
      .from("calls")
      .select("premium_micro_algos, refund_micro_algos, breach, settlement_tx_id");
    if (error) return { error: error.message };
    const list = calls ?? [];
    const totalCalls = list.length;
    const breaches = list.filter((c) => c.breach).length;
    const premiumSum = list.reduce(
      (a, c) => a + Number(c.premium_micro_algos ?? 0),
      0,
    );
    const refundSum = list.reduce(
      (a, c) => a + Number(c.refund_micro_algos ?? 0),
      0,
    );
    const settledCalls = list.filter((c) => c.settlement_tx_id).length;

    const { count: endpointCount } = await this.db.client
      .from("endpoints")
      .select("*", { count: "exact", head: true });

    const { count: settleFailures, error: failErr } = await this.db.client
      .from("settle_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed");

    const { data: x402Jobs, error: x402Err } = await this.db.client
      .from("settle_jobs")
      .select("id")
      .not("payload->>x402SettlementTxId", "is", null);
    const x402CoverageJobs = x402Err ? null : (x402Jobs?.length ?? 0);

    const failedCount = failErr ? null : (settleFailures ?? 0);
    const breachRate =
      totalCalls > 0 ? Number((breaches / totalCalls).toFixed(6)) : null;
    const settleFailureRate =
      failedCount !== null && totalCalls > 0
        ? Number((failedCount / totalCalls).toFixed(6))
        : failedCount;

    return {
      network: "algorand:testnet",
      asset: "algo",
      totalCalls,
      breaches,
      breachRate,
      premiumMicroAlgos: premiumSum,
      refundMicroAlgos: refundSum,
      settledCalls,
      settleFailures: failedCount,
      settleFailureRate,
      settleFailuresNote: failErr ? "settle failure count unavailable" : undefined,
      x402CoverageJobs,
      x402CoverageJobsNote:
        x402CoverageJobs === null
          ? "x402 count unavailable (query error)"
          : "settle_jobs with payload.x402SettlementTxId",
      endpoints: endpointCount ?? 0,
    };
  }
}
