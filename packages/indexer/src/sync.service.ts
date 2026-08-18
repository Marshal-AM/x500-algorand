import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { existsSync } from "node:fs";
import {
  AlgorandAdapter,
  resolveDeploymentsPath,
  type EndpointConfigSnapshot,
} from "@x500/shared";
import { SupabaseService } from "./supabase.service.js";

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SyncService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private adapter: AlgorandAdapter | null = null;

  constructor(@Inject(SupabaseService) private readonly db: SupabaseService) {}

  onModuleInit(): void {
    const ms = Number(process.env.INDEXER_SYNC_INTERVAL_MS ?? 120_000);
    if (ms <= 0) {
      this.log.warn("INDEXER_SYNC_INTERVAL_MS=0 — on-chain sync disabled");
      return;
    }
    const path = resolveDeploymentsPath();
    if (!existsSync(path)) {
      this.log.warn(`No deployments file at ${path} — sync idle`);
      return;
    }
    this.adapter = new AlgorandAdapter({
      deploymentsPath: path,
    });
    void this.tick().catch(() => {});
    this.timer = setInterval(() => {
      void this.tick().catch(() => {});
    }, ms);
    this.log.log(`sync loop every ${ms}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async syncNow(): Promise<number> {
    return this.tick();
  }

  async syncEndpoint(slug: string): Promise<boolean> {
    if (!this.adapter) return false;
    const ep = await this.adapter.getEndpoint(slug);
    if (!ep) return false;
    const ok = await this.upsertEndpoint(ep);
    if (ok) this.log.log(`synced endpoint ${slug} hostname=${ep.hostname}`);
    return ok;
  }

  private async upsertEndpoint(ep: EndpointConfigSnapshot): Promise<boolean> {
    const row: Record<string, unknown> = {
      slug: ep.slug,
      network: "algorand:testnet",
      hostname: ep.hostname,
      sla_ms: ep.slaLatencyMs > 0 ? ep.slaLatencyMs : 30_000,
      flat_premium_micro_algos: Number(ep.flatPremiumMicroAlgos),
      imputed_cost_micro_algos: Number(ep.imputedCostMicroAlgos),
      api_price_micro_usdc: Number(ep.apiPriceMicroUsdc),
      contact_address: ep.contactAddress,
      paused: ep.paused,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.db.client
      .from("endpoints")
      .upsert(row, { onConflict: "slug" });
    if (error) {
      this.log.error(
        `upsert ${ep.slug} failed: ${error.message} sla=${ep.slaLatencyMs}`,
      );
      return false;
    }
    return true;
  }

  private async tick(): Promise<number> {
    if (!this.adapter) return 0;
    try {
      const endpoints = await this.adapter.readEndpointConfigs();
      let synced = 0;
      for (const ep of endpoints) {
        if (await this.upsertEndpoint(ep)) synced += 1;
      }
      this.log.log(
        `synced ${synced}/${endpoints.length} endpoints from chain` +
          (endpoints.length > 0
            ? ` (${endpoints.map((e) => e.slug).join(", ")})`
            : ""),
      );
      return synced;
    } catch (err) {
      this.log.error(
        `sync tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    }
  }
}
