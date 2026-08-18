import { fetchIndexer, formatMicroUsdc } from "@/lib/indexer";
import { PageHeader } from "@/components/ui/Alert";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { DataTableShell } from "@/components/ui/PagePrimitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

export const dynamic = "force-dynamic";

interface EndpointRow {
  slug: string;
  hostname: string;
  sla_ms: number;
  flat_premium_micro_algos: number;
  api_price_micro_usdc: number;
  imputed_cost_micro_algos: number;
  paused: boolean;
}

export default async function EndpointsPage() {
  const data = await fetchIndexer<{ endpoints: EndpointRow[] }>("/api/endpoints");
  const endpoints = data.endpoints ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Endpoints"
        description="Registered APIs with pricing, coverage, and response limits."
      />

      <Surface title="All endpoints" emphasis>
        <DataTableShell
          isEmpty={endpoints.length === 0}
          empty="No endpoints registered yet."
          scrollable
          maxHeight="28rem"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead align="right">SLA</TableHead>
                <TableHead align="right">API price</TableHead>
                <TableHead align="right">Premium</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((ep, idx) => (
                <TableRow
                  key={ep.slug}
                  interactive
                  animate
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <TableCell className="font-medium">{ep.slug}</TableCell>
                  <TableCell
                    className="max-w-[16rem] truncate font-mono text-xs"
                    title={ep.hostname}
                  >
                    {ep.hostname}
                  </TableCell>
                  <TableCell align="right">{ep.sla_ms} ms</TableCell>
                  <TableCell align="right">
                    {formatMicroUsdc(ep.api_price_micro_usdc ?? 1_000_000)} USDC
                  </TableCell>
                  <TableCell align="right">
                    {formatMicroUsdc(ep.flat_premium_micro_algos)} USDC
                  </TableCell>
                  <TableCell>
                    {ep.paused ? (
                      <Badge variant="warning">Paused</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
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
