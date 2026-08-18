import { AlgorandAdapter } from "@x500/shared";

async function main(): Promise<void> {
  const agent = process.env.ALGORAND_AGENT_ADDRESS?.trim();
  if (!agent) throw new Error("ALGORAND_AGENT_ADDRESS required");
  const adapter = new AlgorandAdapter({
    deploymentsPath: process.env.X500_DEPLOYMENTS_PATH?.trim(),
  });
  const e = await adapter.checkAgentEligibility(agent, 1_000_000n);
  console.log(JSON.stringify(e, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
