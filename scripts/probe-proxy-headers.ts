async function main(): Promise<void> {
  const agent = process.env.ALGORAND_AGENT_ADDRESS?.trim();
  if (!agent) throw new Error("ALGORAND_AGENT_ADDRESS required");
  const url =
    process.env.PROBE_URL?.trim() ??
    "http://127.0.0.1:8788/v1/weather-slow/paid/weather?city=London";

  const res = await fetch(url, {
    headers: { "x-x500-agent-address": agent },
  });
  console.log("status", res.status);
  for (const [k, v] of res.headers.entries()) {
    if (
      k.toLowerCase().includes("payment") ||
      k.toLowerCase().startsWith("x-x500")
    ) {
      console.log(k, v.slice(0, 120));
    }
  }
  console.log("body", (await res.text()).slice(0, 300));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
