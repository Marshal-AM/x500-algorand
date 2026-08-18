/**
 * Algorand connectivity smoke test.
 */
import { existsSync } from "node:fs";
import { loadDeployments } from "x500-protocol-algorand-v1-client";

const indexerUrl =
  process.env.ALGORAND_INDEXER_URL?.trim() ??
  "https://testnet-idx.algonode.cloud";
const facilitatorUrl =
  process.env.FACILITATOR_URL?.trim() ??
  "https://facilitator.goplausible.xyz";

async function main(): Promise<void> {
  console.log("[algorand-smoke] indexer:", indexerUrl);
  const idxRes = await fetch(`${indexerUrl.replace(/\/$/, "")}/health`);
  console.log("[algorand-smoke] indexer health:", idxRes.status);

  console.log("[algorand-smoke] facilitator:", facilitatorUrl);
  const facRes = await fetch(`${facilitatorUrl.replace(/\/$/, "")}/health`);
  const facBody = await facRes.text();
  console.log(
    "[algorand-smoke] facilitator health:",
    facRes.status,
    facBody.slice(0, 120),
  );

  const deploymentsPath =
    process.env.X500_DEPLOYMENTS_PATH?.trim() ||
    "config/deployments.algorand.testnet.json";
  if (existsSync(deploymentsPath)) {
    const d = loadDeployments(deploymentsPath);
    console.log("[algorand-smoke] deployments:", {
      registry: d.registry.appId,
      pool: d.pool.appId,
      settler: d.settler.appId,
    });
    if (d.registry.appId === 0 || d.pool.appId === 0 || d.settler.appId === 0) {
      console.warn(
        "[algorand-smoke] deployments contain placeholder app IDs — run pnpm protocol:deploy",
      );
    }
  } else {
    console.warn(
      `[algorand-smoke] missing deployments file ${deploymentsPath}`,
    );
  }

  const supabaseUrl = process.env.ALGORAND_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    const sbRes = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
      headers: {
        apikey: process.env.ALGORAND_SUPABASE_ANON_KEY?.trim() ?? "",
      },
    });
    console.log("[algorand-smoke] supabase rest:", sbRes.status);
  }

  console.log("[algorand-smoke] OK");
}

main().catch((err) => {
  console.error("[algorand-smoke] failed", err);
  process.exit(1);
});
