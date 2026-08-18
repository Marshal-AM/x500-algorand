import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { existsSync } from "node:fs";
import { AlgorandAdapter, resolveDeploymentsPath } from "@x500/shared";
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

  private async tick(): Promise<number> {
    if (!this.adapter) return 0;
    try {
      const endpoints = await this.adapter.readEndpointConfigs();
      let synced = 0;
      for (const ep of endpoints) {
        const row: Record<string, unknown> = {
          slug: ep.slug,
          network: "algorand:testnet",
          hostname: ep.hostname,
          api_price_micro_usdc: Number(ep.apiPriceMicroUsdc),
          contact_address: ep.contactAddress,
          paused: ep.paused,
          updated_at: new Date().toISOString(),
        };
        if (ep.slaLatencyMs > 0) row.sla_ms = ep.slaLatencyMs;
        if (ep.flatPremiumMicroAlgos > 0n) {
          row.flat_premium_micro_algos = Number(ep.flatPremiumMicroAlgos);
        }
        if (ep.imputedCostMicroAlgos > 0n) {
          row.imputed_cost_micro_algos = Number(ep.imputedCostMicroAlgos);
        }
        const { error } = await this.db.client.from("endpoints").upsert(row);
        if (error) {
          this.log.error(
            `upsert ${ep.slug} failed: ${error.message} sla=${ep.slaLatencyMs} imputed=${ep.imputedCostMicroAlgos}`,
          );
          continue;
        }
        synced += 1;
      }
      this.log.log(`synced ${synced} endpoints from chain`);
      return synced;
    } catch (err) {
      this.log.error(
        `sync tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    }
  }
}
