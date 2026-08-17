import { describe, expect, it, vi } from "vitest";
import { Batcher, MAX_BATCH_SIZE, type BatchedJob } from "./batcher.js";
import { InMemoryLeaseStore } from "./lease-memory.js";
import { mapOutcomeToSettle } from "./outcome-map.js";

function job(partial: Partial<BatchedJob> & { jobId: string; slug: string }): BatchedJob {
  return {
    callId: partial.jobId,
    agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    premiumMicroAlgos: 1n,
    refundMicroAlgos: 0n,
    latencyMs: 1,
    outcome: "ok",
    wrapOutcome: "ok",
    payload: {},
    ...partial,
  };
}

describe("mapOutcomeToSettle", () => {
  it("maps covered breaches", () => {
    expect(mapOutcomeToSettle("server_error")).toBe("breach");
    expect(mapOutcomeToSettle("ok")).toBe("ok");
    expect(mapOutcomeToSettle("client_error")).toBe("ok");
  });
});

describe("Batcher", () => {
  it("does not flush below MAX_BATCH_SIZE before timer", async () => {
    const flushed: BatchedJob[][] = [];
    const b = new Batcher(async (jobs) => {
      flushed.push(jobs);
    }, MAX_BATCH_SIZE, 60_000);
    for (let i = 0; i < MAX_BATCH_SIZE - 1; i++) {
      b.push(job({ jobId: `j${i}`, slug: "dummy" }));
    }
    expect(b.pendingCount).toBe(MAX_BATCH_SIZE - 1);
    expect(flushed).toHaveLength(0);
    await b.stop();
  });

  it("flushes on size", async () => {
    const flushed: BatchedJob[][] = [];
    const b = new Batcher(async (jobs) => {
      flushed.push(jobs);
    }, MAX_BATCH_SIZE, 60_000);
    for (let i = 0; i < MAX_BATCH_SIZE; i++) {
      b.push(job({ jobId: `j${i}`, slug: "dummy" }));
    }
    await vi.waitFor(() => expect(flushed).toHaveLength(1));
    expect(flushed[0]).toHaveLength(MAX_BATCH_SIZE);
  });

  it("flushes current slug before accepting another", async () => {
    const flushed: BatchedJob[][] = [];
    const b = new Batcher(async (jobs) => {
      flushed.push(jobs);
    }, MAX_BATCH_SIZE, 60_000);
    b.push(job({ jobId: "a", slug: "dummy" }));
    b.push(job({ jobId: "b", slug: "other" }));
    await vi.waitFor(() => expect(flushed.length).toBeGreaterThanOrEqual(1));
    expect(flushed[0]?.[0]?.slug).toBe("dummy");
    await b.stop();
  });
});

describe("InMemoryLeaseStore", () => {
  it("two workers cannot double-claim the same job", () => {
    const store = new InMemoryLeaseStore([
      { id: "1", status: "pending" },
      { id: "2", status: "pending" },
    ]);
    const a = store.claim(10, "worker-a");
    const b = store.claim(10, "worker-b");
    expect(a.map((j) => j.id).sort()).toEqual(["1", "2"]);
    expect(b).toHaveLength(0);
  });

  it("reclaims stale leases", () => {
    const store = new InMemoryLeaseStore([
      {
        id: "1",
        status: "leased",
        lockedBy: "old",
        leaseExpiresAt: Date.now() - 1000,
      },
    ]);
    const claimed = store.claim(1, "worker-b");
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.lockedBy).toBe("worker-b");
  });
});
