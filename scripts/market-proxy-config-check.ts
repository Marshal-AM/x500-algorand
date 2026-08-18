import { DEFAULT_MARKET_PROXY_URL } from "x500-agent-sdk";

function resolveProxyBase(): string {
  return (
    process.env.MARKET_PROXY_URL ??
    process.env.PROXY_URL ??
    DEFAULT_MARKET_PROXY_URL
  )
    .trim()
    .replace(/\/$/, "");
}

function main(): void {
  const effective = resolveProxyBase();
  const expectProd = process.env.EXPECT_PROD_PROXY === "1";

  console.log("[config] MARKET_PROXY_URL", process.env.MARKET_PROXY_URL ?? "");
  console.log("[config] PROXY_URL", process.env.PROXY_URL ?? "");
  console.log("[config] effective", effective);

  if (expectProd && effective.includes("127.0.0.1")) {
    throw new Error(
      `Expected prod proxy, got local ${effective}. Set MARKET_PROXY_URL to Cloud Run.`,
    );
  }
}

try {
  main();
  console.log("[config] ok");
} catch (err) {
  console.error("[config] fail", err);
  process.exit(1);
}
