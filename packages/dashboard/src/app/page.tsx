import {
  fetchIndexer,
  formatMicroAlgos,
  sortCallsNewestFirst,
} from "@/lib/indexer";
import { CallsTable, type CallTableRow } from "@/components/CallsTable";
import { PageHeader } from "@/components/ui/Alert";
import { Surface } from "@/components/ui/Surface";
import { DataTableShell, StatCard } from "@/components/ui/PagePrimitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

export const dynamic = "force-dynamic";

interface Stats {
  totalCalls: number;
  breaches: number;
  breachRate: number | null;
  premiumMicroAlgos: number;
  refundMicroAlgos: number;
  settledCalls: number;
  settleFailures: number | null;
  x402CoverageJobs: number | null;
  endpoints: number;
}

interface PoolRow {
  endpoint_slug: string;
  balance_micro_algos: number;
}

export default async function HomePage() {
  const stats = await fetchIndexer<Stats>("/api/stats");
  const calls = await fetchIndexer<{ calls: CallTableRow[] }>(
    "/api/calls?limit=50",
  );
  const pool = await fetchIndexer<{ pools: PoolRow[] }>("/api/pool");
  const callRows = sortCallsNewestFirst(calls.calls ?? []).slice(0, 20);
  const poolRows = [...(pool.pools ?? [])].sort(
    (a, b) => Number(b.balance_micro_algos) - Number(a.balance_micro_algos),
  );
  const breachPct =
    stats.breachRate != null
      ? `${(stats.breachRate * 100).toFixed(1)}%`
      : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Network activity, pool balances, and recent insured API calls."
      />

      <div className="network-strip">
        <span>
          <strong>{stats.endpoints}</strong> active endpoints
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong>{stats.settledCalls}</strong> settled calls
        </span>
        <span aria-hidden>·</span>
        <span>Read-only explorer — no wallet required</span>
      </div>

      <div className="overview-hero">
        <StatCard label="Total calls" value={stats.totalCalls} highlight />
        <StatCard
          label="Breach rate"
          value={breachPct}
          sublabel={`${stats.breaches} breaches`}
          highlight
        />
        <StatCard
          label="Premiums collected"
          value={`${formatMicroAlgos(stats.premiumMicroAlgos)}`}
          sublabel="ALGO"
          highlight
        />
        <StatCard
          label="Refunds issued"
          value={`${formatMicroAlgos(stats.refundMicroAlgos)}`}
          sublabel="ALGO"
          highlight
        />
      </div>

      <Surface title="Network metrics">
        <div className="stat-grid stat-grid--centered">
          <StatCard label="Endpoints" value={stats.endpoints} />
          <StatCard label="Settled calls" value={stats.settledCalls} />
          <StatCard label="Total breaches" value={stats.breaches} />
          {stats.settleFailures != null && (
            <StatCard label="Settlement failures" value={stats.settleFailures} />
          )}
          {stats.x402CoverageJobs != null && (
            <StatCard label="Coverage jobs" value={stats.x402CoverageJobs} />
          )}
        </div>
      </Surface>

      <Surface title="Pool liquidity" emphasis>
        <DataTableShell
          isEmpty={poolRows.length === 0}
          empty="No pool balances yet."
          scrollable
          maxHeight="24rem"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead align="right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poolRows.map((p, idx) => (
                <TableRow
                  key={p.endpoint_slug}
                  interactive
                  animate
                  style={{ animationDelay: `${idx * 25}ms` }}
                >
                  <TableCell className="font-medium">
                    {p.endpoint_slug}
                  </TableCell>
                  <TableCell align="right">
                    {formatMicroAlgos(p.balance_micro_algos)} ALGO
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableShell>
      </Surface>

      <Surface title="Recent calls">
        <CallsTable
          calls={callRows}
          showAgent
          maxHeight="24rem"
        />
      </Surface>
    </div>
  );
}
