/**
 * Curl live indexer /api/stats and print KPI snapshot JSON.
 */
const INDEXER_URL = (
  process.env.INDEXER_URL?.trim() ||
  "https://indexer-production-ab11.up.railway.app"
).replace(/\/$/, "");

async function main(): Promise<void> {
  const res = await fetch(`${INDEXER_URL}/api/stats`);
  if (!res.ok) {
    throw new Error(`/api/stats → ${res.status}`);
  }
  const stats = await res.json();
  const snapshot = {
    capturedAt: new Date().toISOString(),
    indexerUrl: INDEXER_URL,
    stats,
  };
  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((err) => {
  console.error("[fail] kpi-snapshot", err);
  process.exit(1);
});
