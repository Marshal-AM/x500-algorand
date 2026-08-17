import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

export const PACKAGE_NAME = "@x500/dummy-upstream" as const;

function merchantPayTo(): string {
  return (
    process.env.ALGORAND_MERCHANT_ADDRESS?.trim() ||
    process.env.ALGORAND_OPERATOR_ADDRESS?.trim() ||
    ""
  );
}

function paidPriceMicroUsdc(): string {
  return process.env.DUMMY_X402_PRICE_MICRO_USDC?.trim() || "5000";
}

export async function createDummyApp(): Promise<Hono> {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, service: "dummy-upstream" }));

  app.get("/quote/:symbol", async (c) => {
    const fail = c.req.query("fail");
    const latencyRaw = c.req.query("latency");
    const latencyMs = latencyRaw ? Number(latencyRaw) : 0;
    if (Number.isFinite(latencyMs) && latencyMs > 0) {
      await new Promise((r) => setTimeout(r, latencyMs));
    }
    if (fail === "1" || fail === "true") {
      return c.json(
        { ok: false, error: "forced_failure", symbol: c.req.param("symbol") },
        503,
      );
    }
    return c.json({
      ok: true,
      symbol: c.req.param("symbol"),
      price: "100.00",
      network: ALGORAND_TESTNET_CAIP2,
      asset: USDC_TESTNET_ASA_ID,
    });
  });

  const facilitatorUrl = (
    process.env.FACILITATOR_URL ?? "https://facilitator.goplausible.xyz"
  ).replace(/\/$/, "");
  const payTo = merchantPayTo();

  if (payTo) {
    const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
    const x402Server = new x402ResourceServer(facilitatorClient)
      .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme());

    const priceUsd = `$${Number(paidPriceMicroUsdc()) / 1_000_000}`;
    const paymentConfig = {
      "GET /paid/quote/:symbol": {
        accepts: [
          {
            scheme: "exact" as const,
            price: priceUsd,
            network: ALGORAND_TESTNET_CAIP2,
            payTo,
            extra: { asset: Number(USDC_TESTNET_ASA_ID) },
          },
        ],
        description: "USDC-paid quote (x402 Exact)",
      },
    };
    app.use(paymentMiddleware(paymentConfig, x402Server));
  } else {
    console.warn(
      "[dummy-upstream] ALGORAND_MERCHANT_ADDRESS unset — /paid/* unavailable",
    );
  }

  app.get("/paid/quote/:symbol", async (c) => {
    if (!payTo) {
      return c.json(
        {
          error: "x402_not_configured",
          message: "Set ALGORAND_MERCHANT_ADDRESS + FACILITATOR_URL",
        },
        503,
      );
    }
    return c.json({
      ok: true,
      paid: true,
      symbol: c.req.param("symbol"),
      network: ALGORAND_TESTNET_CAIP2,
      asset: USDC_TESTNET_ASA_ID,
      priceMicroUsdc: paidPriceMicroUsdc(),
    });
  });

  return app;
}

export async function startDummyServer(
  port = Number(process.env.DUMMY_UPSTREAM_PORT ?? 8790),
) {
  const app = await createDummyApp();
  return serve({ fetch: app.fetch, port }, () => {
    console.log(`[dummy-upstream] listening on :${port}`);
  });
}
