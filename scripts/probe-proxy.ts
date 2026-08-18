async function main(): Promise<void> {
  const agent = process.env.ALGORAND_AGENT_ADDRESS?.trim() ?? "";
  const urls = [
    "http://127.0.0.1:8788/v1/pay-default/paid/weather?city=Paris",
    "http://127.0.0.1:8800/paid/weather?city=Paris",
  ];
  for (const u of urls) {
    const r = await fetch(u, {
      headers: agent ? { "x-x500-agent-address": agent } : {},
    });
    console.log("\n===", u, "===");
    console.log("status", r.status);
    for (const [k, v] of r.headers) {
      if (k.startsWith("x-x500") || k.includes("payment")) console.log(k, v);
    }
    const t = await r.text();
    console.log(t.slice(0, 1200));
  }
}

main().catch(console.error);
