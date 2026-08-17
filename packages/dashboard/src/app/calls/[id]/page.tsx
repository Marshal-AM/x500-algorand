import {
  fetchIndexer,
  formatMicroAlgos,
  algorandTxExplorerUrl,
} from "@/lib/indexer";
import { PageHeader, EmptyState } from "@/components/ui/Alert";
import { Surface } from "@/components/ui/Surface";
import { ToastOnMount } from "@/components/ToastOnMount";
import { DetailList, DetailRow } from "@/components/ui/DetailList";
import { StatusPill, TableLink } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

interface Call {
  call_id: string;
  agent_address: string;
  endpoint_slug: string;
  outcome: string;
  latency_ms: number;
  premium_micro_algos: number;
  refund_micro_algos: number;
  breach: boolean;
  status: string;
  settlement_tx_id: string | null;
  network: string;
  asset: string;
  created_at: string;
}

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchIndexer<{ call: Call | null }>(
    `/api/calls/${encodeURIComponent(id)}`,
  );
  const call = data.call;

  if (!call) {
    return (
      <div className="space-y-6">
        <ToastOnMount
          variant="warning"
          title="Call not found"
          description="This call ID is not in the indexer."
        />
        <PageHeader title="Call not found" />
        <EmptyState>No record matches this call ID.</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call detail"
        description={
          <span className="font-mono text-sm text-muted-foreground">
            {call.call_id}
          </span>
        }
      />

      <Surface title="Summary" emphasis size="lg">
        <DetailList>
          <DetailRow
            term="Agent"
            value={
              <TableLink href={`/agents/${call.agent_address}`} mono>
                {call.agent_address}
              </TableLink>
            }
          />
          <DetailRow term="Endpoint" value={call.endpoint_slug} />
          <DetailRow
            term="Outcome"
            value={
              <StatusPill tone={call.breach ? "danger" : "success"}>
                {call.breach ? "Breach" : call.outcome}
              </StatusPill>
            }
          />
          <DetailRow term="Latency" value={`${call.latency_ms} ms`} />
          <DetailRow
            term="Premium"
            value={`${formatMicroAlgos(call.premium_micro_algos)} ALGO`}
          />
          <DetailRow
            term="Refund"
            value={`${formatMicroAlgos(call.refund_micro_algos)} ALGO`}
          />
          <DetailRow term="Status" value={call.status} />
          <DetailRow
            term="Settlement"
            value={
              call.settlement_tx_id ? (
                <a
                  href={algorandTxExplorerUrl(call.settlement_tx_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary no-underline hover:underline"
                >
                  {call.settlement_tx_id}
                </a>
              ) : (
                "Pending"
              )
            }
            mono={!!call.settlement_tx_id}
          />
          <DetailRow term="Network" value={call.network} />
          <DetailRow term="Created" value={call.created_at} />
        </DetailList>
      </Surface>
    </div>
  );
}
