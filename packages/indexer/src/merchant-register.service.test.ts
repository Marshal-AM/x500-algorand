import { describe, expect, it } from "vitest";
import { MerchantRegisterService } from "./merchant-register.service.js";

describe("MerchantRegisterService validation", () => {
  const svc = new MerchantRegisterService({ client: {} } as never, {
    syncNow: async () => 0,
    syncEndpoint: async () => false,
  } as never);

  it("accepts valid slug", () => {
    expect(svc.validateSlug("my-api")).toBe("my-api");
  });

  it("rejects invalid slug", () => {
    expect(() => svc.validateSlug("")).toThrow();
    expect(() => svc.validateSlug("pay-default")).toThrow(/reserved/);
    expect(() => svc.validateSlug("-bad")).toThrow();
  });

  it("requires absolute hostname", () => {
    expect(() => svc.validateHostname("api.example.com", "x")).toThrow(/http/);
    expect(svc.validateHostname("https://api.example.com/", "x")).toBe(
      "https://api.example.com",
    );
  });
});

describe("MerchantRegisterService syncAfterWalletRegistration", () => {
  const hostname = "https://merchant.example.com";
  const row = {
    slug: "my-api",
    hostname,
    api_price_micro_usdc: 10_000,
    contact_address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  };

  it("succeeds once syncEndpoint writes the slug", async () => {
    const db = {
      client: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      },
    };
    const sync = {
      syncNow: async () => 0,
      syncEndpoint: async () => true,
    };
    const register = new MerchantRegisterService(db as never, sync as never);
    const result = await register.syncAfterWalletRegistration({
      slug: "my-api",
      hostname,
      transactionId: "TXID",
      slaMs: 30_000,
    });
    expect(result.ok).toBe(true);
    expect(result.slug).toBe("my-api");
    expect(result.hostname).toBe(hostname);
    expect(result.alreadyRegistered).toBe(false);
  });

  it("retries until the slug appears after chain sync", async () => {
    let lookups = 0;
    const db = {
      client: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                lookups += 1;
                return {
                  data: lookups >= 2 ? row : null,
                  error: null,
                };
              },
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      },
    };
    const sync = {
      syncNow: async () => 1,
      syncEndpoint: async () => lookups >= 1,
    };
    const register = new MerchantRegisterService(db as never, sync as never);
    const result = await register.syncAfterWalletRegistration({
      slug: "my-api",
      hostname,
      transactionId: "TXID",
    });
    expect(result.ok).toBe(true);
    expect(result.alreadyRegistered).toBe(true);
    expect(lookups).toBeGreaterThanOrEqual(2);
  });
});
