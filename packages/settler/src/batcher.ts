export const MAX_BATCH_SIZE = 3;
export const BATCH_FLUSH_MS = 5_000;

export interface BatchedJob {
  jobId: string;
  slug: string;
  callId: string;
  agentAddress: string;
  premiumMicroAlgos: bigint;
  refundMicroAlgos: bigint;
  latencyMs: number;
  outcome: "ok" | "breach";
  wrapOutcome: string;
  payload: Record<string, unknown>;
}

export type FlushHandler = (jobs: BatchedJob[]) => Promise<void>;

export class Batcher {
  private pending: BatchedJob[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  constructor(
    private readonly onFlush: FlushHandler,
    private readonly maxSize = MAX_BATCH_SIZE,
    private readonly flushMs = BATCH_FLUSH_MS,
  ) {}

  get pendingCount(): number {
    return this.pending.length;
  }

  push(job: BatchedJob): void {
    if (this.pending.length > 0 && this.pending[0]!.slug !== job.slug) {
      void this.flush();
    }
    this.pending.push(job);
    if (this.pending.length >= this.maxSize) {
      void this.flush();
      return;
    }
    this.armTimer();
  }

  private armTimer(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.flushMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.clearTimer();
    if (this.pending.length === 0) return;
    this.flushing = true;
    const batch = this.pending.splice(0, this.pending.length);
    try {
      await this.onFlush(batch);
    } finally {
      this.flushing = false;
      if (this.pending.length >= this.maxSize) {
        void this.flush();
      } else if (this.pending.length > 0) {
        this.armTimer();
      }
    }
  }

  async stop(): Promise<void> {
    this.clearTimer();
    await this.flush();
  }
}
