import {
  fetchIndexer,
  formatCallTime,
  formatMicroAlgos,
  sortCallsNewestFirst,
} from "@/lib/indexer";
import { PageHeader, EmptyState } from "@/components/ui/Alert";
import { Surface } from "@/components/ui/Surface";
import { StatCard } from "@/components/ui/PagePrimitives";
import { DataTableShell } from "@/components/ui/PagePrimitives";
import { ToastOnMount } from "@/components/ToastOnMount";
import {
  AlgorandTxLink,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableLink,
  TableRow,
} from "@/components/ui/Table";

export const dynamic = "force-dynamic";

interface Agent {
  address: string;
  total_premiums_micro_algos: number;
  total_refunds_micro_algos: number;
  call_count: number;
}

interface CallRow {
  call_id: string;
  endpoint_slug: string;
  outcome: string;
  premium_micro_algos: number;
  refund_micro_algos: number;
  breach?: boolean;
  settlement_tx_id: string | null;
  created_at: string;
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const agentData = await fetchIndexer<{ agent: Agent | null }>(
    `/api/agents/${encodeURIComponent(address)}`,
  );
  const callsData = await fetchIndexer<{ calls: CallRow[] }>(
    `/api/agents/${encodeURIComponent(address)}/calls`,
  );

  const agent = agentData.agent;
  if (!agent) {
    return (
      <div className="space-y-6">
        <ToastOnMount
          variant="warning"
          title="Agent not found"
          description={`No record for ${address}.`}
        />
        <PageHeader title="Agent not found" />
        <EmptyState>No activity recorded for this address.</EmptyState>
      </div>
    );
  }

  const callRows = sortCallsNewestFirst(callsData.calls ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={agent.address}
        description="Premiums, refunds, and call history for this address."
      />

      <Surface title="Summary">
        <div className="stat-grid">
          <StatCard label="Calls" value={agent.call_count} highlight />
          <StatCard
            label="Premiums"
            value={formatMicroAlgos(agent.total_premiums_micro_algos)}
            sublabel="ALGO"
          />
          <StatCard
            label="Refunds"
            value={formatMicroAlgos(agent.total_refunds_micro_algos)}
            sublabel="ALGO"
          />
        </div>
      </Surface>

      <Surface title="Call history" emphasis>
        <DataTableShell
          isEmpty={callRows.length === 0}
          empty="No calls yet."
          scrollable
          maxHeight="24rem"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Call</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead align="right">Premium</TableHead>
                <TableHead align="right">Refund</TableHead>
                <TableHead>Settlement</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callRows.map((c, idx) => (
                <TableRow
                  key={c.call_id}
                  interactive
                  animate
                  style={{ animationDelay: `${idx * 25}ms` }}
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatCallTime(c.created_at)}
                  </TableCell>
                  <TableCell>
                    <TableLink href={`/calls/${c.call_id}`} mono>
                      {c.call_id.slice(0, 10)}…
                    </TableLink>
                  </TableCell>
                  <TableCell className="font-medium">{c.endpoint_slug}</TableCell>
                  <TableCell align="right">
                    {formatMicroAlgos(c.premium_micro_algos)}
                  </TableCell>
                  <TableCell align="right">
                    {formatMicroAlgos(c.refund_micro_algos)}
                  </TableCell>
                  <TableCell>
                    {c.settlement_tx_id ? (
                      <AlgorandTxLink txId={c.settlement_tx_id} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={c.breach ? "danger" : "neutral"}>
                      {c.outcome}
                    </StatusPill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableShell>
      </Surface>
    </div>
  );
}
