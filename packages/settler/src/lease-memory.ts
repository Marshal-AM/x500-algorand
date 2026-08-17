/**
 * In-memory lease store for unit tests (simulates claim FOR UPDATE SKIP LOCKED).
 */
export interface MemoryJob {
  id: string;
  status: "pending" | "leased" | "done" | "failed";
  leaseExpiresAt?: number;
  lockedBy?: string;
}

export class InMemoryLeaseStore {
  constructor(private readonly jobs: MemoryJob[]) {}

  claim(limit: number, worker: string, now = Date.now()): MemoryJob[] {
    const out: MemoryJob[] = [];
    for (const job of this.jobs) {
      if (out.length >= limit) break;
      const stale =
        job.status === "leased" &&
        job.leaseExpiresAt !== undefined &&
        job.leaseExpiresAt < now;
      if (job.status === "pending" || stale) {
        job.status = "leased";
        job.lockedBy = worker;
        job.leaseExpiresAt = now + 60_000;
        out.push(job);
      }
    }
    return out;
  }
}
