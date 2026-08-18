import { describe, expect, it, vi } from "vitest";
import { EventsController } from "./events.controller.js";

function mockDb(existingHostname: string | null) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "endpoints") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: existingHostname ? { hostname: existingHostname } : null,
            }),
          }),
        }),
        upsert,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === "agents") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    }
    if (table === "calls") {
      return { upsert: vi.fn().mockResolvedValue({ error: null }) };
    }
    return {};
  });

  return { client: { from }, upsert, update };
}

describe("EventsController hostname handling", () => {
  it("does not rewrite endpoint economics when settler omits them", async () => {
    const db = mockDb("https://exampleserver-432303484897.us-central1.run.app");
    const controller = new EventsController({ client: db.client } as never);

    const result = await controller.ingest({
      callId: "test-call-preserve-hostname",
      agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      endpointSlug: "fastservertest",
      outcome: "ok",
      latencyMs: 100,
      premiumMicroAlgos: "10000",
      refundMicroAlgos: "0",
      breach: false,
      status: "settled",
    });

    expect(result).toEqual({ ok: true, callId: "test-call-preserve-hostname" });

    const endpointsTable = db.client.from("endpoints");
    expect(endpointsTable.upsert).not.toHaveBeenCalled();
  });

  it("does not upsert hostname with slug when no existing row", async () => {
    const db = mockDb(null);
    const controller = new EventsController({ client: db.client } as never);

    await controller.ingest({
      callId: "test-call-no-hostname",
      agentAddress: "AGENTADDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      endpointSlug: "fastservertest",
      outcome: "ok",
      latencyMs: 100,
      premiumMicroAlgos: "10000",
      refundMicroAlgos: "0",
      breach: false,
    });

    const endpointsTable = db.client.from("endpoints");
    expect(endpointsTable.upsert).not.toHaveBeenCalled();
  });
});
