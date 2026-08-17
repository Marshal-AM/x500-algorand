/**
 * Initialize x500 Algorand protocol after deploy (smoke check + log app IDs).
 */
import { deployments, operatorAccount } from "./lib/algorand.js";

async function main(): Promise<void> {
  const d = deployments();
  const account = operatorAccount();
  console.log("[init] authority", account.addr.toString());
  console.log("[init] registry appId", d.registry.appId);
  console.log("[init] pool appId", d.pool.appId);
  console.log("[init] settler appId", d.settler.appId);
  console.log(
    "[ok] protocol init — stub TEAL apps deployed; grant settler roles when full contracts ship",
  );
}

main().catch((err) => {
  console.error("[fail] init-protocol-algorand", err);
  process.exit(1);
});
