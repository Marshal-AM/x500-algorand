import { afterEach, describe, expect, it, vi } from "vitest";
import algosdk from "algosdk";
import { createX500 } from "./createX500.js";

describe("createX500", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects mainnet", () => {
    expect(() =>
      createX500({
        network: "mainnet",
        address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        mnemonic: algosdk.secretKeyToMnemonic(
          algosdk.generateAccount().sk,
        ),
      }),
    ).toThrow(/testnet/);
  });

  it("requires credentials", () => {
    expect(() =>
      createX500({
        network: "testnet",
        address: "",
        mnemonic: "",
      }),
    ).toThrow(/mnemonic/);
  });

  it("fetch emits billed on mocked proxy response", async () => {
    const account = algosdk.generateAccount();
    const address = account.addr.toString();

    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-x500-call-id": "call-1",
          "x-x500-premium": "1000000",
          "x-x500-refund": "0",
          "x-x500-outcome": "ok",
          "x-x500-asset": "algo",
          "x-x500-network": "algorand:testnet",
        },
      });
    });

    const billed: string[] = [];
    const x500 = createX500({
      network: "testnet",
      address,
      mnemonic: algosdk.secretKeyToMnemonic(account.sk),
      proxyUrl: "http://proxy.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    x500.on("billed", (e) => billed.push(e.premiumMicroAlgos ?? ""));

    const res = await x500.fetch("http://proxy.test/v1/dummy/quote/algo");
    expect(res.ok).toBe(true);
    expect(billed).toEqual(["1000000"]);
    expect(fetchImpl).toHaveBeenCalled();
    await x500.close();
  });

  it("fetch auto-resolves merchant origin URLs via indexer", async () => {
    const account = algosdk.generateAccount();
    const address = account.addr.toString();

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const u =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (u.includes("/api/endpoints/resolve")) {
        return new Response(
          JSON.stringify({
            endpoint: {
              slug: "dummy",
              hostname: "merchant.test",
              api_price_micro_usdc: 5000,
              flat_premium_micro_algos: 500_000,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      expect(u).toBe(
        "http://proxy.test/v1/dummy/paid/weather?city=Paris",
      );
      return new Response(JSON.stringify({ city: "Paris", temp: 20 }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-x500-call-id": "call-2",
          "x-x500-premium": "500000",
          "x-x500-refund": "0",
          "x-x500-outcome": "ok",
        },
      });
    });

    const x500 = createX500({
      network: "testnet",
      address,
      mnemonic: algosdk.secretKeyToMnemonic(account.sk),
      proxyUrl: "http://proxy.test",
      indexerUrl: "http://indexer.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await x500.fetch(
      "https://merchant.test/paid/weather?city=Paris",
    );
    expect(res.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await x500.close();
  });
});
