import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AlgorandAdapter } from "@x500/shared";
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
    const path = join(
      process.cwd(),
      "config",
      "deployments.algorand.testnet.json",
    );
    if (!existsSync(path)) {
      this.log.warn("No deployments.algorand.testnet.json — sync idle");
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
        const { error } = await this.db.client.from("endpoints").upsert({
          slug: ep.slug,
          network: "algorand:testnet",
          hostname: ep.hostname,
          sla_ms: ep.slaLatencyMs,
          flat_premium_micro_algos: Number(ep.flatPremiumMicroAlgos),
          imputed_cost_micro_algos: Number(ep.imputedCostMicroAlgos),
          api_price_micro_usdc: Number(ep.apiPriceMicroUsdc),
          contact_address: ep.contactAddress,
          paused: ep.paused,
          updated_at: new Date().toISOString(),
        });
        if (!error) synced += 1;
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
