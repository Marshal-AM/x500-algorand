function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function resolveProxyBase(): string {
  return (
    process.env.MARKET_PROXY_URL ??
    process.env.PROXY_URL ??
    "http://127.0.0.1:8788"
  )
    .trim()
    .replace(/\/$/, "");
}

async function main(): Promise<void> {
  const proxyBase = resolveProxyBase();
  const slug = process.env.MARKET_PROXY_SLUG?.trim() || "paidservice";
  const path = (process.env.MARKET_PROXY_PATH?.trim() || "paid/random").replace(
    /^\//,
    "",
  );
  const accountId = requireEnv("X500_AGENT_ACCOUNT_ID");
  const url = `${proxyBase}/v1/${slug}/${path}`;

  console.log("[smoke] url", url);
  const res = await fetch(url, {
    headers: { "x-x500-agent-account-id": accountId },
  });
  const body = await res.text();
  console.log("[smoke] status", res.status);

  if (res.status === 500 && body.includes("Phase2RequiredError")) {
    throw new Error(`Phase2RequiredError regression: ${body}`);
  }
  if (res.status !== 402) {
    throw new Error(`Expected 402, got ${res.status}: ${body}`);
  }

  const callId = res.headers.get("x-x500-call-id");
  const network = res.headers.get("x-x500-network");
  if (!callId || !network) {
    throw new Error(
      `Missing x500 headers (callId=${callId}, network=${network})`,
    );
  }

  console.log("[smoke] ok callId", callId, "network", network);
}

main().catch((err) => {
  console.error("[smoke] fail", err);
  process.exit(1);
});
