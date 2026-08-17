/**
 * Algorand connectivity smoke test.
 */
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
  console.log("[algorand-smoke] facilitator health:", facRes.status, facBody.slice(0, 120));

  console.log("[algorand-smoke] OK");
}

main().catch((err) => {
  console.error("[algorand-smoke] failed", err);
  process.exit(1);
});
