import { MerchantRegisterForm } from "@/components/MerchantRegisterForm";
import { PageHeader } from "@/components/ui/Alert";
import { Surface } from "@/components/ui/Surface";

export const dynamic = "force-dynamic";

export default function MerchantRegisterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Register your API"
        description="Connect your wallet to register or update a listing. Slugs are verified before you sign."
      />

      <Surface title="Registration" emphasis size="fit">
        <MerchantRegisterForm />
      </Surface>
    </div>
  );
}
