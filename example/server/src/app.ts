import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";
import ngrok from "@ngrok/ngrok";
import {
  DEFAULT_FACILITATOR_URL,
  DEFAULT_INDEXER_URL,
  loraTxUrl,
} from "x500-sdk-algorand";
import { fetchCityWeather, CityNotFoundError } from "./weather.js";

export interface MerchantRuntimeConfig {
  origin: string;
  slug: string;
  payTo: string;
  apiPriceMicroUsdc: string;
}

export async function fetchMerchantConfig(
  publicOrigin: string,
): Promise<MerchantRuntimeConfig> {
  const origin = publicOrigin.replace(/\/$/, "");
  const url = `${DEFAULT_INDEXER_URL}/api/endpoints/resolve?origin=${encodeURIComponent(origin)}`;
  const res = await fetch(url);
  const raw = await res.text();
  console.log(
    `[example-server] indexer resolve status=${res.status} url=${url}`,
  );
  const body = (raw ? JSON.parse(raw) : {}) as {
    error?: string;
    endpoint?: {
      slug: string;
      api_price_micro_usdc?: number;
      contact_address?: string | null;
    };
  };

  if (!res.ok || body.error || !body.endpoint?.slug) {
    throw new Error(
      `Origin not registered on x500: ${origin}. Register it in the dashboard (Merchants → Register) and restart this server.${body.error ? ` (${body.error})` : ""}`,
    );
  }

  const payTo = body.endpoint.contact_address?.trim();
  if (!payTo) {
    throw new Error(
      `Registration for ${origin} is missing Algorand address. Re-register in dashboard with your wallet.`,
    );
  }

  return {
    origin,
    slug: body.endpoint.slug,
    payTo,
    apiPriceMicroUsdc: String(body.endpoint.api_price_micro_usdc ?? 5000),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForRegistration(
  publicOrigin: string,
): Promise<MerchantRuntimeConfig> {
  const origin = publicOrigin.replace(/\/$/, "");
  console.log(
    `[example-server] Register this origin in the dashboard if you haven't:\n  ${origin}`,
  );
  for (;;) {
    try {
      return await fetchMerchantConfig(origin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("not registered") && !msg.includes("missing Algorand")) {
        throw err;
      }
      console.log("[example-server] waiting for dashboard registration…");
      await sleep(5000);
    }
  }
}

export async function createExampleApp(
  config: MerchantRuntimeConfig,
): Promise<Hono> {
  const app = new Hono();
  const facilitatorUrl = (
    process.env.FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL
  ).replace(/\/$/, "");

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "example-merchant-server",
      slug: config.slug,
      apiPriceMicroUsdc: config.apiPriceMicroUsdc,
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
      description: "USDC-paid city weather (x402 Exact on Algorand)",
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

  try {
      const weather = await fetchCityWeather(city);
      const settlementTxId = c.res.headers.get("payment-response") ?? null;
      return c.json({
        ok: true,
        paid: true,
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

export async function startExampleServer(
  port = Number(process.env.SERVER_PORT ?? 8800),
): Promise<void> {
  const token = process.env.NGROK_AUTHTOKEN?.trim();
  if (!token) {
    throw new Error("NGROK_AUTHTOKEN required in example/server/.env");
  }

  const listener = await ngrok.forward({ addr: port, authtoken: token });
  const publicUrl = listener.url()!.replace(/\/$/, "");

  console.log(`[ngrok] public url: ${publicUrl}`);
  console.log(`[example-server] loading config from x500 indexer…`);

  const config = await waitForRegistration(publicUrl);

  console.log(`[example-server] registered slug: ${config.slug}`);
  console.log(`[example-server] payTo: ${config.payTo} (from dashboard)`);
  console.log(
    `[example-server] api price: ${config.apiPriceMicroUsdc} microUSDC`,
  );
  console.log(`[example-server] facilitator: ${DEFAULT_FACILITATOR_URL}`);

  const app = await createExampleApp(config);

  serve({ fetch: app.fetch, port }, () => {
    console.log(`[example-server] listening on http://127.0.0.1:${port}`);
    console.log(`[example-server] paid route: GET /paid/weather?city=...`);
    console.log(
      `[example-server] test: curl -i http://127.0.0.1:${port}/paid/weather?city=London`,
    );
  });
}
