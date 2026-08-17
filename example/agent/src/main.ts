import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { createX500 } from "x500-sdk-algorand";
import { z } from "zod";
import {
  formatMicroAlgos,
  formatMicroUsdc,
  logPaymentBreakdown,
} from "./payment-log.js";

const GROQ_MODEL = "openai/gpt-oss-120b";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main(): Promise<void> {
  const address = requireEnv("X500_AGENT_ADDRESS");
  const mnemonic = requireEnv("ALGORAND_AGENT_MNEMONIC");
  const merchantOrigin = requireEnv("X500_MERCHANT_ORIGIN");
  requireEnv("GROQ_API_KEY");

  const x500 = createX500({
    network: "testnet",
    address,
    mnemonic,
  });

  x500.on("refund", (e) => {
    console.log(
      `\n[x500] Refund event: ${formatMicroAlgos(e.refundMicroAlgos)} ALGO` +
        (e.callId ? ` (call ${e.callId})` : ""),
    );
  });
  x500.on("failure", (e) => {
    console.log(
      `\n[x500] Call failed: outcome=${e.outcome ?? "unknown"} status=${e.status}`,
    );
  });

  const balance = await x500.getBalance();
  const merchantWeatherBase = `${merchantOrigin.replace(/\/$/, "")}/paid/weather`;
  const resolved = await x500.resolveMerchant(merchantOrigin);

  console.log(`[agent] Algorand address ${address}`);
  console.log(`[agent] Wallet balance: ${formatMicroAlgos(balance)} ALGO`);
  console.log(`[agent] Merchant origin: ${merchantOrigin}`);
  console.log(`[agent] Resolved slug: ${resolved.slug} (via indexer)`);
  if (resolved.apiPriceMicroUsdc) {
    console.log(
      `[agent] Merchant /paid API price: ${formatMicroUsdc(resolved.apiPriceMicroUsdc)}`,
    );
  }
  if (resolved.flatPremiumMicroAlgos) {
    console.log(
      `[agent] Insurance premium per call: ${formatMicroAlgos(resolved.flatPremiumMicroAlgos)} ALGO`,
    );
  }
  console.log(`[agent] Insured weather URL: ${merchantWeatherBase}?city=...`);
  console.log(`\n[agent] Groq model: ${GROQ_MODEL}`);
  console.log("[agent] CLI ready. Ask for weather in a city (exit to quit).\n");

  const weatherTool = tool(
    async ({ city }) => {
      const url = `${merchantWeatherBase}?city=${encodeURIComponent(city)}`;
      const res = await x500.fetch(url);
      const text = await res.text();
      if (!res.ok) {
        const bodyPreview = text.slice(0, 800) || "(empty)";
        console.log(`[x500] response body: ${bodyPreview}`);
      }
      await logPaymentBreakdown({
        x500,
        res,
        bodyText: text,
        configuredApiPriceMicroUsdc: resolved.apiPriceMicroUsdc,
        routeLabel: `GET /paid/weather?city=${city}`,
      });
      if (!res.ok) {
        return `insured API error ${res.status}: ${text}`;
      }
      return text;
    },
    {
      name: "get_insured_weather",
      description:
        "Fetch current weather for a city from the merchant x402 API through x500 insured proxy.",
      schema: z.object({
        city: z.string().describe("City name, e.g. London, Tokyo, New York"),
      }),
    },
  );

  const llm = new ChatGroq({
    model: GROQ_MODEL,
    temperature: 0.2,
    fetch: globalThis.fetch.bind(globalThis),
  });

  const agent = createReactAgent({
    llm,
    tools: [weatherTool],
    checkpointSaver: new MemorySaver(),
    messageModifier:
      "You must call get_insured_weather when the user asks for weather. Summarize JSON in plain language.",
  });

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const line = await rl.question("You: ");
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        break;
      }

      let result;
      try {
        result = await agent.invoke({
          messages: [new HumanMessage(trimmed)],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n[agent] Groq request failed: ${msg}\n`);
        continue;
      }

      const outMessages = result.messages as Array<{ content?: unknown }>;
      const last = outMessages.at(-1);
      const reply =
        typeof last?.content === "string"
          ? last.content
          : JSON.stringify(last?.content ?? "");
      console.log(`\nAgent: ${reply}\n`);
    }
  } finally {
    rl.close();
    await x500.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
