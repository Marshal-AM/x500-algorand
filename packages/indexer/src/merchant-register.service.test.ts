import { describe, expect, it } from "vitest";
import { MerchantRegisterService } from "./merchant-register.service.js";

describe("MerchantRegisterService validation", () => {
  const svc = new MerchantRegisterService({ client: {} } as never, {
    syncNow: async () => 0,
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
