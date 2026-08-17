import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 py-8">
      <div className="flex flex-col items-center gap-4 px-[var(--page-gutter)] text-center">
        <Logo variant="footer" />
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          Parametric insurance for agent API payments on Algorand testnet.{" "}
          <Link href="/merchants/register" className="text-primary">
            List your API
          </Link>
        </p>
      </div>
    </footer>
  );
}
