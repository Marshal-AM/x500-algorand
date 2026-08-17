"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMicroAlgos, indexerBase } from "@/lib/indexer";
import { appToast } from "@/lib/toast";
import { CallsTable, type CallTableRow } from "@/components/CallsTable";
import { Dialog } from "@/components/ui/Dialog";
import { StatCard } from "@/components/ui/PagePrimitives";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface AgentRow {
  address: string;
  total_premiums_micro_algos: number;
  total_refunds_micro_algos: number;
  call_count: number;
  last_call_at: string | null;
}

function AgentCallsModal({
  agent,
  open,
  onClose,
}: {
  agent: AgentRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [calls, setCalls] = useState<CallTableRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCalls = useCallback(async (address: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${indexerBase()}/api/agents/${encodeURIComponent(address)}/calls`,
      );
      if (!res.ok) {
        throw new Error(`Failed to load calls (${res.status})`);
      }
      const body = (await res.json()) as { calls?: CallTableRow[] };
      setCalls(body.calls ?? []);
    } catch (err) {
      appToast.error("Could not load agent calls", err);
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !agent?.address) {
      setCalls([]);
      return;
    }
    void loadCalls(agent.address);
  }, [open, agent?.address, loadCalls]);

  if (!agent) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={agent.address}
      description="Insured API calls and settlement transactions for this agent."
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
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

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Loading calls…
          </p>
        ) : (
          <CallsTable
            calls={calls}
            maxHeight="26rem"
            empty="No calls for this agent yet."
          />
        )}

        <div className="flex justify-end border-t border-border/80 pt-4">
          <Link
            href={`/agents/${agent.address}`}
            className={buttonVariants({ variant: "outline" })}
            onClick={onClose}
          >
            Open full agent page
          </Link>
        </div>
      </div>
    </Dialog>
  );
}

function AgentsTable({
  agents,
  onSelect,
}: {
  agents: AgentRow[];
  onSelect: (agent: AgentRow) => void;
}) {
  return (
    <table className="data-table__table w-full caption-bottom text-left">
      <thead className="data-table__head">
        <tr>
          <th className="px-6 py-4 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Address
          </th>
          <th className="px-6 py-4 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Calls
          </th>
          <th className="px-6 py-4 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Premiums
          </th>
          <th className="px-6 py-4 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Refunds
          </th>
          <th className="px-6 py-4 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Last active
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60 text-[0.8125rem]">
        {agents.map((a, idx) => (
          <tr
            key={a.address}
            className={cn(
              "data-table__row--interactive border-b border-border/55 transition-colors",
              "data-table__row--animate cursor-pointer",
            )}
            style={{ animationDelay: `${idx * 25}ms` }}
            onClick={() => onSelect(a)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(a);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`View calls for agent ${a.address}`}
          >
            <td className="px-6 py-4 font-mono text-xs font-medium text-primary">
              {a.address}
            </td>
            <td className="px-6 py-4 text-right tabular-nums">{a.call_count}</td>
            <td className="px-6 py-4 text-right tabular-nums">
              {formatMicroAlgos(a.total_premiums_micro_algos)} ALGO
            </td>
            <td className="px-6 py-4 text-right tabular-nums">
              {formatMicroAlgos(a.total_refunds_micro_algos)} ALGO
            </td>
            <td className="px-6 py-4 text-muted-foreground">
              {a.last_call_at ?? "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AgentsLeaderboardPanel({ agents }: { agents: AgentRow[] }) {
  const [selected, setSelected] = useState<AgentRow | null>(null);

  return (
    <>
      <AgentsTable agents={agents} onSelect={setSelected} />
      <AgentCallsModal
        agent={selected}
        open={selected != null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
