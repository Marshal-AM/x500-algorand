import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { PushSecretGuard } from "./push-secret.guard.js";
import { SupabaseService } from "./supabase.service.js";

export interface IngestEventBody {
  callId: string;
  agentAddress: string;
  endpointSlug: string;
  outcome: string;
  latencyMs: number;
  premiumMicroAlgos: string | number;
  refundMicroAlgos: string | number;
  breach: boolean;
  status?: string;
  settlementTxId?: string;
  network?: string;
  asset?: string;
  feeShares?: Array<{ recipientAddress: string; amountMicroAlgos: string | number }>;
  endpoint?: {
    hostname?: string;
    slaMs?: number;
    flatPremiumMicroAlgos?: string | number;
    imputedCostMicroAlgos?: string | number;
    percentBps?: number;
    paused?: boolean;
    poolBalanceMicroAlgos?: string | number;
  };
}

@Controller("events")
@UseGuards(PushSecretGuard)
export class EventsController {
  constructor(@Inject(SupabaseService) private readonly db: SupabaseService) {}

  @Post()
  async ingest(@Body() body: IngestEventBody) {
    const agentAddress =
      body.agentAddress ??
      (body as { agentAccountId?: string }).agentAccountId;
    if (!body?.callId || !agentAddress || !body.endpointSlug) {
      return { ok: false, error: "callId, agentAddress, endpointSlug required" };
    }
    const network = body.network ?? "algorand:testnet";
    const asset = body.asset ?? "algo";
    if (network !== "algorand:testnet") {
      return { ok: false, error: "only algorand:testnet accepted" };
    }

    const premium = BigInt(body.premiumMicroAlgos ?? 0);
    const refund = BigInt(body.refundMicroAlgos ?? 0);

    const ep = body.endpoint ?? {};

    const { data: existingEndpoint } = await this.db.client
      .from("endpoints")
      .select("hostname")
      .eq("slug", body.endpointSlug)
      .maybeSingle();

    const hostname = ep.hostname?.trim() || existingEndpoint?.hostname;
    const hasEndpointEconomics =
      (ep.slaMs !== undefined && ep.slaMs > 0) ||
      ep.flatPremiumMicroAlgos !== undefined ||
      ep.imputedCostMicroAlgos !== undefined ||
      ep.paused !== undefined;

    if (hostname && hasEndpointEconomics) {
      const row: Record<string, unknown> = {
        slug: body.endpointSlug,
        network,
        hostname,
        updated_at: new Date().toISOString(),
      };
      if (ep.slaMs !== undefined && ep.slaMs > 0) row.sla_ms = ep.slaMs;
      if (ep.flatPremiumMicroAlgos !== undefined) {
        row.flat_premium_micro_algos = Number(ep.flatPremiumMicroAlgos);
      }
      if (ep.imputedCostMicroAlgos !== undefined) {
        const imputed = Number(ep.imputedCostMicroAlgos);
        if (imputed > 0) row.imputed_cost_micro_algos = imputed;
      }
      if (ep.percentBps !== undefined) row.percent_bps = ep.percentBps;
      if (ep.paused !== undefined) row.paused = ep.paused;
      if (ep.poolBalanceMicroAlgos !== undefined) {
        row.pool_balance_micro_algos = Number(ep.poolBalanceMicroAlgos);
      }
      await this.db.client.from("endpoints").upsert(row, { onConflict: "slug" });
    } else if (ep.poolBalanceMicroAlgos !== undefined) {
      await this.db.client
        .from("endpoints")
        .update({
          pool_balance_micro_algos: Number(ep.poolBalanceMicroAlgos),
          updated_at: new Date().toISOString(),
        })
        .eq("slug", body.endpointSlug);
    }

    const { data: existingAgent } = await this.db.client
      .from("agents")
      .select("*")
      .eq("address", agentAddress)
      .maybeSingle();

    await this.db.client.from("agents").upsert(
      {
        address: agentAddress,
        total_premiums_micro_algos:
          Number(existingAgent?.total_premiums_micro_algos ?? 0) +
          Number(premium),
        total_refunds_micro_algos:
          Number(existingAgent?.total_refunds_micro_algos ?? 0) +
          Number(refund),
        call_count: Number(existingAgent?.call_count ?? 0) + 1,
        last_call_at: new Date().toISOString(),
      },
      { onConflict: "address" },
    );

    await this.db.client.from("calls").upsert(
      {
        call_id: body.callId,
        agent_address: agentAddress,
        endpoint_slug: body.endpointSlug,
        outcome: body.outcome,
        latency_ms: body.latencyMs,
        premium_micro_algos: Number(premium),
        refund_micro_algos: Number(refund),
        breach: body.breach,
        status: body.status ?? "settled",
        network,
        asset,
        settlement_tx_id: body.settlementTxId ?? null,
      },
      { onConflict: "call_id" },
    );

    if (body.settlementTxId) {
      const { data: settlement, error: sErr } = await this.db.client
        .from("settlements")
        .upsert(
          {
            tx_id: body.settlementTxId,
            network,
            asset,
          },
          { onConflict: "tx_id" },
        )
        .select("id")
        .single();
      if (!sErr && settlement?.id && body.feeShares?.length) {
        for (const share of body.feeShares) {
          await this.db.client.from("settlement_fee_shares").insert({
            settlement_id: settlement.id,
            recipient_address: share.recipientAddress,
            amount_micro_algos: Number(share.amountMicroAlgos),
          });
        }
      }
    }

    if (ep.poolBalanceMicroAlgos !== undefined) {
      await this.db.client.from("pool_state").upsert(
        {
          endpoint_slug: body.endpointSlug,
          balance_micro_algos: Number(ep.poolBalanceMicroAlgos),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint_slug" },
      );
    }

    return { ok: true, callId: body.callId };
  }
}
