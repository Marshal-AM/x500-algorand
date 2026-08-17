"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";

const NAV_ITEMS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/", label: "Overview", exact: true },
  { href: "/endpoints", label: "Endpoints" },
  { href: "/agents", label: "Agents" },
  { href: "/merchants", label: "Merchants" },
];

export function AppNavbar() {
  const pathname = usePathname();

  return (
    <header className="shrink-0 bg-transparent pt-5 md:pt-6">
      <div className="flex h-[72px] w-full items-center justify-between bg-transparent px-[var(--page-gutter)] transition-all duration-300">
        <Logo variant="nav" />

        <nav className="tab-pill-bar" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn("tab-pill-btn", active && "active")}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
