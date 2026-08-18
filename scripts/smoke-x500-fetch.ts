import { createX500 } from "../packages/x500-sdk-algorand/src/createX500.ts";

async function main(): Promise<void> {
  const address = process.env.ALGORAND_AGENT_ADDRESS?.trim();
  const mnemonic = process.env.ALGORAND_AGENT_MNEMONIC?.trim();
  if (!address || !mnemonic) throw new Error("agent creds required");

  const x500 = createX500({ network: "testnet", address, mnemonic });
  const url = "http://127.0.0.1:8800/paid/weather?city=Paris";
  console.log("GET", url);
  const res = await x500.fetch(url);
  const body = await res.text();
  console.log("status", res.status);
  console.log("outcome", res.headers.get("x-x500-outcome"));
  console.log("premium", res.headers.get("x-x500-premium"));
  console.log("body", body.slice(0, 400));
  await x500.close();
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
