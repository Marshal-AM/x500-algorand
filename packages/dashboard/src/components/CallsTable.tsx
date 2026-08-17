import {
  formatCallTime,
  formatMicroAlgos,
  sortCallsNewestFirst,
} from "@/lib/indexer";
import { DataTableShell } from "@/components/ui/PagePrimitives";
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

export interface CallTableRow {
  call_id: string;
  agent_address?: string;
  endpoint_slug: string;
  outcome: string;
  premium_micro_algos: number;
  breach: boolean;
  settlement_tx_id: string | null;
  created_at: string;
}

function outcomeTone(
  outcome: string,
  breach: boolean,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (breach) return "danger";
  const normalized = outcome.toLowerCase();
  if (normalized.includes("success") || normalized.includes("settled")) {
    return "success";
  }
  if (normalized.includes("refund") || normalized.includes("fail")) {
    return "warning";
  }
  return "neutral";
}

export function CallsTable({
  calls,
  showAgent = false,
  scrollable = true,
  maxHeight = "22rem",
  empty = "No calls recorded yet.",
}: {
  calls: CallTableRow[];
  showAgent?: boolean;
  scrollable?: boolean;
  maxHeight?: string;
  empty?: string;
}) {
  const rows = sortCallsNewestFirst(calls);

  return (
    <DataTableShell
      isEmpty={rows.length === 0}
      empty={empty}
      scrollable={scrollable}
      maxHeight={maxHeight}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            {showAgent ? <TableHead>Agent</TableHead> : null}
            <TableHead>Endpoint</TableHead>
            <TableHead align="right">Premium</TableHead>
            <TableHead>Settlement</TableHead>
            <TableHead>Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c, idx) => (
            <TableRow
              key={c.call_id}
              interactive
              animate
              style={{ animationDelay: `${idx * 20}ms` }}
            >
              <TableCell className="whitespace-nowrap text-muted-foreground">
                <TableLink href={`/calls/${c.call_id}`}>
                  {formatCallTime(c.created_at)}
                </TableLink>
              </TableCell>
              {showAgent && c.agent_address ? (
                <TableCell>
                  <TableLink href={`/agents/${c.agent_address}`} mono>
                    {c.agent_address}
                  </TableLink>
                </TableCell>
              ) : null}
              <TableCell className="font-medium">{c.endpoint_slug}</TableCell>
              <TableCell align="right">
                {formatMicroAlgos(c.premium_micro_algos)}
              </TableCell>
              <TableCell>
                {c.settlement_tx_id ? (
                  <AlgorandTxLink txId={c.settlement_tx_id} />
                ) : (
                  <span className="text-xs text-muted-foreground">Pending</span>
                )}
              </TableCell>
              <TableCell>
                <StatusPill tone={outcomeTone(c.outcome, c.breach)}>
                  {c.breach ? "Breach" : c.outcome}
                </StatusPill>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableShell>
  );
}
