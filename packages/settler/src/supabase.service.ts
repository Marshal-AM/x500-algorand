import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { SettleJobsClient } from "@x500/db-algorand";
import { requireAlgorandSupabaseConfig } from "@x500/db-algorand";

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  readonly client: SettleJobsClient;
  readonly raw: SupabaseClient;

  constructor() {
    const { url, serviceRoleKey: key } = requireAlgorandSupabaseConfig();
    this.raw = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transport: WebSocket as any,
      },
    });
    this.client = this.raw as unknown as SettleJobsClient;
  }

  onModuleDestroy(): void {
    // no-op
  }
}
