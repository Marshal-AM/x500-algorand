import { AlgorandAdapter } from "@x500/shared";
import { resolveDeploymentsPath } from "@x500/shared";
import { loadDeployments } from "x500-protocol-algorand-v1-client";

async function main(): Promise<void> {
  const path = resolveDeploymentsPath(process.env.X500_DEPLOYMENTS_PATH?.trim());
  console.log("cwd", process.cwd());
  console.log("deployments path", path);
  const d = loadDeployments(path);
  console.log("pool app", d.pool.appId, "settler app", d.settler.appId);

  const adapter = new AlgorandAdapter({
    deploymentsPath: process.env.X500_DEPLOYMENTS_PATH?.trim(),
  });
  const eps = await adapter.readEndpointConfigs();
  console.log("endpoint configs", eps.length);
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
