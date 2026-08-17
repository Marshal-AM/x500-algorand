export const ALGO_ASSET = "native" as const;
export const ALGORAND_TESTNET = "algorand:testnet" as const;

const MICRO_UNIT = 1_000_000n;

/** microAlgos → ALGO string with 6 decimal places. */
export function formatMicroAlgos(
  microAlgos: number | string | bigint | null | undefined,
): string {
  if (microAlgos === null || microAlgos === undefined) return "0.000000";
  const n = BigInt(microAlgos);
  const whole = n / MICRO_UNIT;
  const frac = (n % MICRO_UNIT).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

/** microUsdc → USDC string with 6 decimal places. */
export function formatMicroUsdc(
  microUsdc: number | string | bigint | null | undefined,
): string {
  if (microUsdc === null || microUsdc === undefined) return "0.000000";
  const n = BigInt(microUsdc);
  const whole = n / MICRO_UNIT;
  const frac = (n % MICRO_UNIT).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

export function indexerBase(): string {
  return (
    process.env.NEXT_PUBLIC_INDEXER_URL?.trim() ||
    "https://xindexer-5341291432.us-central1.run.app"
  ).replace(/\/$/, "");
}

export async function fetchIndexer<T>(path: string): Promise<T> {
  const res = await fetch(`${indexerBase()}${path}`, {
    next: { revalidate: 15 },
  });
  if (!res.ok) {
    throw new Error(`indexer ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Algorand transaction ID → Lora testnet explorer URL. */
export function algorandTxExplorerUrl(txId: string): string {
  const trimmed = txId.trim();
  return `https://lora.algokit.io/testnet/transaction/${encodeURIComponent(trimmed)}`;
}

export function shortenTxId(txId: string, head = 10, tail = 6): string {
  if (txId.length <= head + tail + 1) return txId;
  return `${txId.slice(0, head)}…${txId.slice(-tail)}`;
}

export function shortenAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function formatCallTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sortCallsNewestFirst<T extends { created_at?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
}
