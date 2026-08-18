async function main(): Promise<void> {
  const agent = process.env.ALGORAND_AGENT_ADDRESS?.trim();
  if (!agent) throw new Error("ALGORAND_AGENT_ADDRESS required");

  const url =
    process.env.PROBE_URL?.trim() ??
    "http://127.0.0.1:8788/v1/pay-default/paid/weather?city=Paris";

  const res = await fetch(url, {
    headers: { "x-x500-agent-address": agent },
  });
  const body = await res.text();
  console.log("status", res.status);
  console.log("x-x500-outcome", res.headers.get("x-x500-outcome"));
  console.log("x-x500-premium", res.headers.get("x-x500-premium"));
  console.log("body", body.slice(0, 500));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
