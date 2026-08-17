import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "x500 — Agent Chat",
  description:
    "Chat with an x500-insured AI agent. Test successful API responses or SLA breach scenarios.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overflow-hidden">
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
          <main className="mx-auto flex h-full min-h-0 w-full max-w-[var(--page-max)] flex-col overflow-hidden px-[var(--page-gutter)] py-6">
            <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
