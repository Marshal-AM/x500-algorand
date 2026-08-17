#!/usr/bin/env node
/**
 * x500 CLI — Algorand testnet; amounts in microAlgos / microUSDC.
 */
import { createX500 } from "x500-sdk-algorand";

function usage(): never {
  console.error(`Usage:
  x500-algorand [--network testnet] <url>
  x500-algorand [--network testnet] balance
  x500-algorand [--network testnet] approve
  x500-algorand [--network testnet] pay <url>
  x500-algorand [--network testnet] calls show [callId]
  x500-algorand [--network testnet] agents show [address]

Env: X500_AGENT_ADDRESS, ALGORAND_AGENT_MNEMONIC
Optional: MARKET_PROXY_URL, INDEXER_URL, FACILITATOR_URL
`);
  process.exit(1);
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
  return v;
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  let network: "testnet" | "mainnet" = "testnet";
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--network") {
      const v = args[++i];
      if (v !== "testnet" && v !== "mainnet") {
        console.error("--network must be testnet (V1) or mainnet");
        process.exit(1);
      }
      network = v;
      continue;
    }
    out.push(a);
  }
  return { network, args: out };
}

async function main(): Promise<void> {
  const { network, args } = parseArgs(process.argv.slice(2));
  if (network !== "testnet") {
    console.error("x500-algorand V1 supports --network testnet only");
    process.exit(1);
  }
  if (args.length === 0) usage();

  const x500 = createX500({
    network: "testnet",
    address: requireEnv("X500_AGENT_ADDRESS"),
    mnemonic: requireEnv("ALGORAND_AGENT_MNEMONIC"),
    proxyUrl: process.env.MARKET_PROXY_URL?.trim() || process.env.PROXY_URL?.trim(),
    indexerUrl: process.env.INDEXER_URL?.trim(),
    facilitatorUrl: process.env.FACILITATOR_URL?.trim(),
    deploymentsPath: process.env.X500_DEPLOYMENTS_PATH?.trim(),
  });

  try {
    const cmd = args[0]!;

    if (cmd === "balance") {
      const bal = await x500.getBalance();
      console.log(
        JSON.stringify({
          address: x500.address,
          network: "algorand:testnet",
          asset: "algo",
          balanceMicroAlgos: bal.toString(),
        }),
      );
      return;
    }

    if (cmd === "approve" || cmd === "setup") {
      const r = await x500.setup();
      console.log(JSON.stringify(r));
      return;
    }

    if (cmd === "pay" && args[1]) {
      const res = await x500.pay(args[1]);
      const text = await res.text();
      console.log(res.status, text.slice(0, 500));
      return;
    }

    if (cmd === "calls" && args[1] === "show") {
      const id = args[2];
      if (!id) {
        console.error("calls show requires callId");
        process.exit(1);
      }
      console.log(JSON.stringify(await x500.getCall(id)));
      return;
    }

    if (cmd === "agents" && args[1] === "show") {
      const addr = args[2];
      console.log(JSON.stringify(await x500.getAgent(addr)));
      return;
    }

    if (cmd.startsWith("http") || cmd.startsWith("/")) {
      const res = await x500.fetch(cmd);
      const text = await res.text();
      console.log(res.status, text.slice(0, 500));
      return;
    }

    usage();
  } finally {
    await x500.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
