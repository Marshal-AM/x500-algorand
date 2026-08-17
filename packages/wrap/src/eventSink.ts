import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  insertSettleJob,
  type SettleJobsClient,
} from "@x500/db-algorand";
import {
  getAlgorandSupabaseUrl,
  getAlgorandSupabaseServiceRoleKey,
} from "@x500/db-algorand";
import {
  assertAlgorandTestnet,
  type SettlementEvent,
} from "./types.js";

export interface EventSink {
  publish(event: SettlementEvent): Promise<void>;
}

export class MemoryEventSink implements EventSink {
  public readonly events: SettlementEvent[] = [];

  async publish(event: SettlementEvent): Promise<void> {
    assertAlgorandTestnet(event.network);
    this.events.push(event);
  }

  reset(): void {
    this.events.length = 0;
  }
}

export interface SupabaseEventSinkOptions {
  client?: SettleJobsClient | SupabaseClient;
  url?: string;
  serviceRoleKey?: string;
}

export class SupabaseEventSink implements EventSink {
  private readonly client: SettleJobsClient;

  constructor(opts: SupabaseEventSinkOptions = {}) {
    if (opts.client) {
      this.client = opts.client as SettleJobsClient;
      return;
    }
    const url = opts.url ?? getAlgorandSupabaseUrl();
    const key = opts.serviceRoleKey ?? getAlgorandSupabaseServiceRoleKey();
    if (!url || !key) {
      throw new Error(
        "SupabaseEventSink requires ALGORAND_SUPABASE_URL + ALGORAND_SUPABASE_SERVICE_ROLE_KEY (or client)",
      );
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        transport: WebSocket as never,
      },
    }) as unknown as SettleJobsClient;
  }

  async publish(event: SettlementEvent): Promise<void> {
    assertAlgorandTestnet(event.network);
    if (!event.callId?.trim()) {
      throw new Error("SupabaseEventSink: callId required");
    }
    await insertSettleJob(this.client, {
      callId: event.callId,
      payload: { ...event },
    });
  }
}
