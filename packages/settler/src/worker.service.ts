import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  claimSettleJobs,
  completeSettleJob,
  failSettleJob,
  type SettleJobRow,
} from "@x500/db-algorand";
import { AlgorandAdapter } from "@x500/shared";
import { NATIVE_ALGO_ASSET, ALGORAND_TESTNET } from "@x500/wrap";
import { Batcher, BATCH_FLUSH_MS, MAX_BATCH_SIZE, type BatchedJob } from "./batcher.js";
import { eventFromPayload, pushIndexerEvent } from "./indexer-push.js";
import { mapOutcomeToSettle } from "./outcome-map.js";
import { MetricsService } from "./metrics.service.js";
import { SupabaseService } from "./supabase.service.js";

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WorkerService.name);
  private readonly workerId = `settler-${process.pid}-${Date.now()}`;
  private timer: ReturnType<typeof setInterval> | null = null;
  private batcher: Batcher | null = null;
  private adapter: AlgorandAdapter | null = null;
  private stopped = false;
  private readonly maxAttempts: number;
  private readonly pollMs: number;
  private readonly claimLimit: number;
  private readonly indexerUrl: string;
  private readonly pushSecret: string;

  constructor(
    @Inject(SupabaseService) private readonly db: SupabaseService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {
    this.maxAttempts = Number(process.env.SETTLER_MAX_ATTEMPTS ?? 5);
    this.pollMs = Number(process.env.SETTLER_POLL_MS ?? 2000);
    this.claimLimit = Number(process.env.SETTLER_CLAIM_LIMIT ?? 10);
    this.indexerUrl = process.env.INDEXER_URL?.trim() ?? "";
    this.pushSecret = process.env.INDEXER_PUSH_SECRET?.trim() ?? "";
  }

  onModuleInit(): void {
    const mnemonic = process.env.ALGORAND_SETTLER_MNEMONIC?.trim();
    if (!mnemonic) {
      throw new Error("ALGORAND_SETTLER_MNEMONIC required");
    }
    if (!this.indexerUrl || !this.pushSecret) {
      throw new Error("INDEXER_URL + INDEXER_PUSH_SECRET required");
    }

    this.adapter = new AlgorandAdapter({
      settlerMnemonic: mnemonic,
      deploymentsPath: process.env.X500_DEPLOYMENTS_PATH?.trim(),
    });

    this.batcher = new Batcher(
      (jobs) => this.flushBatch(jobs),
      Number(process.env.SETTLER_MAX_BATCH_SIZE ?? MAX_BATCH_SIZE),
      Number(process.env.SETTLER_BATCH_FLUSH_MS ?? BATCH_FLUSH_MS),
    );
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.pollMs);
    void this.pollOnce();
    this.log.log(`worker ${this.workerId} polling every ${this.pollMs}ms`);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.batcher) await this.batcher.stop();
  }

  private async pollOnce(): Promise<void> {
    if (this.stopped || !this.batcher) return;
    try {
      const rows = await claimSettleJobs(this.db.client, {
        limit: this.claimLimit,
        worker: this.workerId,
        leaseSeconds: Number(process.env.SETTLER_LEASE_SECONDS ?? 120),
      });
      for (const row of rows) {
        try {
          this.batcher.push(this.toBatched(row));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.log.error(`bad job ${row.id}: ${msg}`);
          await failSettleJob(this.db.client, {
            id: row.id,
            error: msg,
            maxAttempts: this.maxAttempts,
            requeue: false,
          });
          this.metrics.jobsFailed += 1;
          this.metrics.lastError = msg;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`poll failed: ${msg}`);
      this.metrics.lastError = msg;
    }
  }

  private toBatched(row: SettleJobRow): BatchedJob {
    const payload =
      typeof row.payload === "object" && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : {};
    const ev = eventFromPayload(payload);
    const premium = BigInt(ev.premiumMicroAlgos);
    if (premium <= 0n) {
      throw new Error(
        `skip settle job with premium_micro_algos=${ev.premiumMicroAlgos} (callId=${ev.callId})`,
      );
    }
    return {
      jobId: row.id,
      slug: ev.endpointSlug,
      callId: ev.callId,
      agentAddress: ev.agentAddress,
      premiumMicroAlgos: premium,
      refundMicroAlgos: BigInt(ev.refundMicroAlgos),
      latencyMs: ev.latencyMs,
      outcome: mapOutcomeToSettle(ev.outcome),
      wrapOutcome: ev.outcome,
      payload,
    };
  }

  private async allSettledOnChain(jobs: BatchedJob[]): Promise<boolean> {
    if (!this.adapter) return false;
    try {
      for (const j of jobs) {
        if (!(await this.adapter.isCallSettled(j.callId))) return false;
      }
      return true;
    } catch (err) {
      this.log.error(
        `isCallSettled check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  private async flushBatch(jobs: BatchedJob[]): Promise<void> {
    if (!this.adapter || jobs.length === 0) return;
    const slug = jobs[0]!.slug;
    this.log.log(`settleBatch slug=${slug} n=${jobs.length}`);
    let txId: string;
    try {
      const result = await this.adapter.submitSettleBatch({
        slug,
        calls: jobs.map((j) => ({
          callId: j.callId,
          agentAddress: j.agentAddress,
          premiumMicroAlgos: j.premiumMicroAlgos,
          refundMicroAlgos: j.refundMicroAlgos,
          outcome: j.outcome,
          latencyMs: j.latencyMs,
        })),
      });
      txId = result.transactionId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const alreadySettled =
        msg.toLowerCase().includes("duplicate") ||
        (await this.allSettledOnChain(jobs));
      if (alreadySettled) {
        this.log.warn(
          `settleBatch slug=${slug} already settled on-chain — completing ${jobs.length} job(s)`,
        );
        for (const j of jobs) {
          await completeSettleJob(this.db.client, j.jobId);
          this.metrics.jobsDone += 1;
        }
        return;
      }
      this.metrics.settleErrors += 1;
      this.metrics.lastError = msg;
      this.log.error(`settleBatch failed: ${msg}`);
      for (const j of jobs) {
        await failSettleJob(this.db.client, {
          id: j.jobId,
          error: msg,
          maxAttempts: this.maxAttempts,
          requeue: true,
        });
        this.metrics.jobsFailed += 1;
      }
      return;
    }

    for (const j of jobs) {
      try {
        await pushIndexerEvent({
          indexerUrl: this.indexerUrl,
          pushSecret: this.pushSecret,
          body: {
            callId: j.callId,
            agentAddress: j.agentAddress,
            endpointSlug: j.slug,
            outcome: j.wrapOutcome,
            latencyMs: j.latencyMs,
            premiumMicroAlgos: j.premiumMicroAlgos.toString(),
            refundMicroAlgos: j.refundMicroAlgos.toString(),
            breach: j.outcome === "breach",
            status: "settled",
            settlementTxId: txId,
            network: ALGORAND_TESTNET,
            asset: NATIVE_ALGO_ASSET,
          },
        });
        await completeSettleJob(this.db.client, j.jobId);
        this.metrics.jobsDone += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.metrics.indexerPushErrors += 1;
        this.metrics.lastError = msg;
        this.log.error(
          `post-settle indexer push failed for ${j.callId} (tx=${txId}): ${msg}`,
        );
        await failSettleJob(this.db.client, {
          id: j.jobId,
          error: `settled on-chain (${txId}) but indexer push failed: ${msg}`,
          maxAttempts: this.maxAttempts,
          requeue: false,
        });
        this.metrics.jobsFailed += 1;
      }
    }
  }
}
