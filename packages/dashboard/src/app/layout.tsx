import type { ReactNode } from "react";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppWalletProvider } from "@/components/WalletProvider";
import { AppToaster } from "@/components/ui/AppToaster";
import "./globals.css";

export const metadata = {
  title: "x500 — Insurance Explorer",
  description:
    "Monitor parametric insurance for AI agent API payments. Explore endpoints, agents, calls, and pool liquidity.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AppWalletProvider>
          <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-background">
            <AppNavbar />
            <main className="mx-auto flex w-full min-w-0 max-w-[var(--page-max)] flex-1 flex-col overflow-x-clip px-[var(--page-gutter)] py-8">
              <div className="w-full min-w-0 max-w-full overflow-x-clip">
                {children}
              </div>
            </main>
            <AppFooter />
            <AppToaster />
          </div>
        </AppWalletProvider>
      </body>
    </html>
  );
}
