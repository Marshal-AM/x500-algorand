import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createX500, type X500Client } from "x500-sdk-algorand";
import { z } from "zod";
import {
  type ChatMessage,
  type ChatTestMode,
  GROQ_MODEL,
  MERCHANT_ORIGINS,
} from "./constants";
import { createLogSink, type LogSink } from "./log-sink";
import { formatMicroAlgos, formatMicroUsdc, logPaymentBreakdown } from "./payment-log";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function attachX500Listeners(x500: X500Client, sink: LogSink) {
  x500.on("refund", (e) => {
    sink.log(
      `\n[x500] Refund event: ${formatMicroAlgos(e.refundMicroAlgos)} ALGO` +
        (e.callId ? ` (call ${e.callId})` : ""),
    );
  });
  x500.on("failure", (e) => {
    sink.log(
      `\n[x500] Call failed: outcome=${e.outcome ?? "unknown"} status=${e.status}`,
    );
  });
}

type MerchantContext = {
  merchantOrigin: string;
  merchantWeatherBase: string;
  resolved: Awaited<ReturnType<X500Client["resolveMerchant"]>>;
};

async function openX500Client(
  mode: ChatTestMode,
  sink: LogSink,
): Promise<{ x500: X500Client; merchant: MerchantContext }> {
  const address = requireEnv("X500_AGENT_ADDRESS");
  const mnemonic = requireEnv("ALGORAND_AGENT_MNEMONIC");
  const merchantOrigin = MERCHANT_ORIGINS[mode];

  const x500 = createX500({
    network: "testnet",
    address,
    mnemonic,
  });

  attachX500Listeners(x500, sink);

  const merchantWeatherBase = `${merchantOrigin.replace(/\/$/, "")}/paid/weather`;

  let resolved: MerchantContext["resolved"];
  try {
    resolved = await x500.resolveMerchant(merchantOrigin);
  } catch (err) {
    await x500.close();
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to resolve merchant for ${merchantOrigin}: ${detail}. ` +
        `Register this origin in the x500 dashboard (Merchants → Register) with slug matching the deployed server.`,
    );
  }

  return {
    x500,
    merchant: { merchantOrigin, merchantWeatherBase, resolved },
  };
}

function logBootstrapInfo(
  sink: LogSink,
  address: string,
  merchant: MerchantContext,
) {
  const { merchantOrigin, merchantWeatherBase, resolved } = merchant;

  sink.log(`[agent] Algorand address ${address}`);
  sink.log(`[agent] Merchant origin: ${merchantOrigin}`);
  sink.log(`[agent] Resolved slug: ${resolved.slug} (via indexer)`);
  if (resolved.apiPriceMicroUsdc) {
    sink.log(
      `[agent] Merchant /paid API price: ${formatMicroUsdc(resolved.apiPriceMicroUsdc)}`,
    );
  }
  if (resolved.flatPremiumMicroAlgos) {
    sink.log(
      `[agent] Insurance premium per call: ${formatMicroAlgos(resolved.flatPremiumMicroAlgos)} ALGO`,
    );
  }
  sink.log(`[agent] Insured weather URL: ${merchantWeatherBase}?city=...`);
  sink.log(`\n[agent] Groq model: ${GROQ_MODEL}`);
  sink.log("[agent] Chat agent ready. Ask for weather in a city.\n");
}

async function createChatAgent(
  x500: X500Client,
  merchant: MerchantContext,
  sink: LogSink,
) {
  requireEnv("GROQ_API_KEY");

  const { merchantWeatherBase, resolved } = merchant;

  const weatherTool = tool(
    async ({ city }) => {
      const url = `${merchantWeatherBase}?city=${encodeURIComponent(city)}`;
      const res = await x500.fetch(url);
      const text = await res.text();
      if (!res.ok) {
        const bodyPreview = text.slice(0, 800) || "(empty)";
        sink.log(`[x500] response body: ${bodyPreview}`);
        const paymentRequired = res.headers.get("payment-required");
        if (paymentRequired && (!text.trim() || text.trim() === "{}")) {
          sink.log(
            `[x500] payment-required header: ${paymentRequired.slice(0, 200)}…`,
          );
        }
      }
      await logPaymentBreakdown({
        x500,
        res,
        bodyText: text,
        configuredApiPriceMicroUsdc: resolved.apiPriceMicroUsdc,
        routeLabel: `GET /paid/weather?city=${city}`,
        sink,
      });
      if (!res.ok) {
        return `insured API error ${res.status}: ${text}`;
      }
      return text;
    },
    {
      name: "get_insured_weather",
      description:
        "Fetch current weather for a city from the merchant x402 API through x500 insured proxy. " +
        "Charges merchant API price (x402) plus insurance premium on success.",
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

  return createReactAgent({
    llm,
    tools: [weatherTool],
    messageModifier:
      "You must always call the get_insured_weather tool when the user asks for weather in a city, even if you know the answer. Summarize the JSON weather response in plain language.",
  });
}

function toLangChainMessages(history: ChatMessage[]) {
  return history.map((m) =>
    m.role === "user"
      ? new HumanMessage(m.content)
      : new AIMessage(m.content),
  );
}

/** Lightweight startup — x500 only, no LangChain/Groq. */
export async function getBootstrapLogs(mode: ChatTestMode): Promise<string[]> {
  const sink = createLogSink();
  const address = requireEnv("X500_AGENT_ADDRESS");
  const { x500, merchant } = await openX500Client(mode, sink);

  try {
    const balance = await x500.getBalance();
    sink.log(`[agent] Wallet balance: ${formatMicroAlgos(balance)} ALGO`);
    logBootstrapInfo(sink, address, merchant);
    return sink.lines;
  } finally {
    await x500.close();
  }
}

export async function runChatAgent(opts: {
  mode: ChatTestMode;
  message: string;
  history: ChatMessage[];
}): Promise<{ reply: string; logs: string[] }> {
  const sink = createLogSink();
  const { x500, merchant } = await openX500Client(opts.mode, sink);
  const agent = await createChatAgent(x500, merchant, sink);

  try {
    const messages = [
      ...toLangChainMessages(opts.history),
      new HumanMessage(opts.message),
    ];

    let result;
    try {
      result = await agent.invoke({ messages });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sink.log(`\n[agent] Groq request failed: ${msg}\n`);
      return { reply: `Agent error: ${msg}`, logs: sink.lines };
    }

    const outMessages = result.messages as Array<{ content?: unknown }>;
    const last = outMessages.at(-1);
    const reply =
      typeof last?.content === "string"
        ? last.content
        : JSON.stringify(last?.content ?? "");

    return { reply, logs: sink.lines };
  } finally {
    await x500.close();
  }
}
