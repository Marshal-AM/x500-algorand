import { fetchIndexer } from "@/lib/indexer";
import { PageHeader } from "@/components/ui/Alert";
import { Surface } from "@/components/ui/Surface";
import { DataTableShell } from "@/components/ui/PagePrimitives";
import { AgentsLeaderboardPanel } from "@/components/AgentsLeaderboard";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const data = await fetchIndexer<{
    agents: Parameters<typeof AgentsLeaderboardPanel>[0]["agents"];
  }>("/api/agents?limit=100");
  const agents = data.agents ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="Accounts making insured API calls across the network. Click a row to view calls."
      />

      <Surface title="Leaderboard" emphasis>
        <DataTableShell
          isEmpty={agents.length === 0}
          empty="No agent activity yet."
          scrollable
          maxHeight="28rem"
        >
          <AgentsLeaderboardPanel agents={agents} />
        </DataTableShell>
      </Surface>
    </div>
  );
}
