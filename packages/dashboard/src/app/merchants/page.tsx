import { PageHeader } from "@/components/ui/Alert";
import { Surface } from "@/components/ui/Surface";
import { GuidancePanel } from "@/components/ui/PagePrimitives";

export default function MerchantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="For merchants"
        description="List your API so agents can call it with built-in insurance coverage."
      />

      <Surface size="lg">
        <GuidancePanel
          title="Get your API listed"
          description="Register your public endpoint on testnet. Agents discover your service automatically and pay per call with coverage handled by the protocol."
          steps={[
            "Host an HTTP API with a public URL.",
            "Choose a slug, set your price, and sign with Pera or Defly.",
            "Agents reach your API through x500 — no extra integration.",
            "Premiums and refunds settle in ALGO automatically.",
          ]}
          primaryAction={{
            label: "Register your API",
            href: "/merchants/register",
          }}
        />
      </Surface>
    </div>
  );
}
