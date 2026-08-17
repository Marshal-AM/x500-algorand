import { Controller, Get, Inject } from "@nestjs/common";
import { SupabaseService } from "./supabase.service.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(SupabaseService) private readonly db: SupabaseService) {}

  @Get()
  async health() {
    const { error } = await this.db.client.from("endpoints").select("slug").limit(1);
    return {
      ok: !error,
      service: "@x500/indexer",
      network: "algorand:testnet",
      asset: "algo",
      db: error ? error.message : "up",
    };
  }
}
