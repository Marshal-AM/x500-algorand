import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "./supabase.service.js";
import { SyncService } from "./sync.service.js";

export interface RegisterMerchantInput {
  slug: string;
  hostname: string;
  transactionId?: string;
  slaMs?: number;
}

export interface RegisterMerchantResult {
  ok: true;
  slug: string;
  hostname: string;
  apiPriceMicroUsdc: string;
  transactionId: string | null;
  alreadyRegistered: boolean;
  proxyPath: string;
  contactAddress?: string;
  ownerAddress?: string;
  slaMs?: number;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,14}[a-z0-9])?$/;

@Injectable()
export class MerchantRegisterService {
  private readonly log = new Logger(MerchantRegisterService.name);

  constructor(
    private readonly db: SupabaseService,
    private readonly sync: SyncService,
  ) {}

  validateSlug(slug: string): string {
    const s = slug.trim().toLowerCase();
    if (!SLUG_RE.test(s)) {
      throw new Error(
        "slug must be 1–16 chars, lowercase alphanumeric and hyphens",
      );
    }
    if (s === "pay-default") {
      throw new Error("slug pay-default is reserved");
    }
    return s;
  }

  validateHostname(hostname: string, slug: string): string {
    const trimmed = hostname.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      throw new Error(
        "hostname must be an absolute URL starting with http:// or https://",
      );
    }
    try {
      new URL(trimmed);
    } catch {
      throw new Error(`invalid hostname URL for slug=${slug}`);
    }
    return trimmed.replace(/\/$/, "");
  }

  validateSlaMs(slaMs: number | undefined): number | undefined {
    if (slaMs === undefined) return undefined;
    if (!Number.isFinite(slaMs) || slaMs <= 0) {
      throw new Error("slaMs must be a positive number (milliseconds)");
    }
    return Math.floor(slaMs);
  }

  async syncAfterWalletRegistration(
    input: RegisterMerchantInput,
  ): Promise<RegisterMerchantResult> {
    const slug = this.validateSlug(input.slug);
    const hostname = this.validateHostname(input.hostname, slug);
    const transactionId = input.transactionId?.trim() || null;
    const slaMs = this.validateSlaMs(input.slaMs);

    for (let attempt = 0; attempt < 8; attempt++) {
      await this.sync.syncNow();
      const { data, error } = await this.db.client
        .from("endpoints")
        .select(
          "slug, hostname, api_price_micro_usdc, contact_address",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        throw new Error(`Supabase endpoints lookup failed: ${error.message}`);
      }
      if (data?.hostname === hostname) {
        if (slaMs !== undefined) {
          const { error: slaErr } = await this.db.client
            .from("endpoints")
            .update({ sla_ms: slaMs })
            .eq("slug", slug);
          if (slaErr) {
            throw new Error(`Supabase SLA update failed: ${slaErr.message}`);
          }
        }
        const proxyBase = (
          process.env.MARKET_PROXY_URL?.trim() || "http://127.0.0.1:8788"
        ).replace(/\/$/, "");

        return {
          ok: true,
          slug,
          hostname: data.hostname,
          apiPriceMicroUsdc: String(data.api_price_micro_usdc ?? 5000),
          transactionId,
          alreadyRegistered: attempt > 0,
          proxyPath: `${proxyBase}/v1/${slug}/`,
          contactAddress: data.contact_address ?? undefined,
          slaMs: slaMs ?? undefined,
        };
      }
      this.log.log(`waiting for on-chain sync slug=${slug} attempt=${attempt + 1}`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    throw new Error(
      `endpoint ${slug} not visible after wallet transaction — retry sync in a minute`,
    );
  }
}
