import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";
import ngrok from "@ngrok/ngrok";
import {
  DEFAULT_FACILITATOR_URL,
  loraTxUrl,
} from "x500-sdk-algorand";
import {
  type MerchantRuntimeConfig,
  waitForRegistration,
} from "./app.js";
import { fetchCityWeather, CityNotFoundError } from "./weather.js";

/** Artificial delay (ms) before the paid route responds. Default 70s to breach a 60s SLA. */
const SLOW_RESPONSE_MS = Number(process.env.SLOW_RESPONSE_MS ?? 70_000);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function createSlowExampleApp(
  config: MerchantRuntimeConfig,
): Promise<Hono> {
  const app = new Hono();
  const facilitatorUrl = (
    process.env.FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL
  ).replace(/\/$/, "");

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "example-merchant-server-slow",
      slug: config.slug,
      apiPriceMicroUsdc: config.apiPriceMicroUsdc,
      slowResponseMs: SLOW_RESPONSE_MS,
      network: ALGORAND_TESTNET_CAIP2,
    }),
  );

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const x402Server = new x402ResourceServer(facilitatorClient)
    .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme());

  const priceUsd = `$${Number(config.apiPriceMicroUsdc) / 1_000_000}`;
  const paymentConfig = {
    "GET /paid/weather": {
      accepts: [
        {
          scheme: "exact" as const,
          price: priceUsd,
          network: ALGORAND_TESTNET_CAIP2,
          payTo: config.payTo,
          extra: { asset: Number(USDC_TESTNET_ASA_ID) },
        },
      ],
      description:
        "USDC-paid city weather (x402 Exact) — intentionally slow for SLA breach demos",
    },
  };

  app.use(paymentMiddleware(paymentConfig, x402Server));

  app.get("/paid/weather", async (c) => {
    const city = c.req.query("city");
    if (!city?.trim()) {
      return c.json(
        { error: "missing_city", message: "Query param city is required" },
        400,
      );
    }

    console.log(
      `[example-server-slow] stalling ${SLOW_RESPONSE_MS}ms before responding…`,
    );
    await sleep(SLOW_RESPONSE_MS);

    try {
      const weather = await fetchCityWeather(city);
      const settlementTxId = c.res.headers.get("payment-response") ?? null;
      return c.json({
        ok: true,
        paid: true,
        slow: true,
        delayedMs: SLOW_RESPONSE_MS,
        weather,
        network: ALGORAND_TESTNET_CAIP2,
        asset: USDC_TESTNET_ASA_ID,
        settlementTxId,
        loraUrl: settlementTxId ? loraTxUrl(settlementTxId) : null,
        priceMicroUsdc: config.apiPriceMicroUsdc,
        ts: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof CityNotFoundError) {
        return c.json({ error: "city_not_found", city: err.city }, 404);
      }
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: "weather_upstream_failed", message }, 502);
    }
  });

  return app;
}

export async function startSlowExampleServer(
  port = Number(process.env.SERVER_PORT ?? 8801),
): Promise<void> {
  const token = process.env.NGROK_AUTHTOKEN?.trim();
  if (!token) {
    throw new Error("NGROK_AUTHTOKEN required in example/server/.env");
  }

  const listener = await ngrok.forward({ addr: port, authtoken: token });
  const publicUrl = listener.url()!.replace(/\/$/, "");

  console.log(`[ngrok] public url: ${publicUrl}`);
  console.log(
    `[example-server-slow] loading config from x500 indexer… (responds after ${SLOW_RESPONSE_MS}ms)`,
  );

  const config = await waitForRegistration(publicUrl);

  console.log(`[example-server-slow] registered slug: ${config.slug}`);
  console.log(`[example-server-slow] payTo: ${config.payTo} (from dashboard)`);
  console.log(
    `[example-server-slow] api price: ${config.apiPriceMicroUsdc} microUSDC`,
  );

  const app = await createSlowExampleApp(config);

  serve({ fetch: app.fetch, port }, () => {
    console.log(`[example-server-slow] listening on http://127.0.0.1:${port}`);
    console.log(
      `[example-server-slow] paid route: GET /paid/weather?city=... (delays ${SLOW_RESPONSE_MS}ms)`,
    );
  });
}
