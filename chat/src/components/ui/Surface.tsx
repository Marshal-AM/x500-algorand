import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Surface({
  className,
  emphasis = false,
  title,
  action,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  emphasis?: boolean;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section
      data-slot="surface"
      className={cn(
        "flex min-h-0 flex-col rounded-[min(var(--radius-3xl),24px)] border border-border bg-card p-5 shadow-[0_1px_0_0_color-mix(in_oklch,white_4%,transparent)_inset,0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl",
        emphasis &&
          "border-primary/25 bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))]",
        className,
      )}
      {...props}
    >
      {title && (
        <header className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <h3
            className={cn(
              "font-heading text-base font-semibold",
              emphasis ? "text-primary" : "text-foreground",
            )}
          >
            {title}
          </h3>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  );
}
