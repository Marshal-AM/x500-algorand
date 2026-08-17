import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { requireAlgorandSupabaseConfig } from "@x500/db-algorand";

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  readonly client: SupabaseClient;

  constructor() {
    const { url, serviceRoleKey: key } = requireAlgorandSupabaseConfig();
    if (!url || !key) {
      throw new Error(
        "ALGORAND_SUPABASE_URL and ALGORAND_SUPABASE_SERVICE_ROLE_KEY are required for indexer",
      );
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Node 20 lacks global WebSocket; indexer only needs REST.
      realtime: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transport: WebSocket as any,
      },
    });
  }

  onModuleDestroy(): void {
    // supabase-js has no explicit close
  }
}
