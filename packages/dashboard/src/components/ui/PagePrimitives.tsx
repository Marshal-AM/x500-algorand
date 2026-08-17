import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface GuidanceAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function GuidancePanel({
  title,
  description,
  steps,
  primaryAction,
  secondaryAction,
  className,
}: {
  title: string;
  description: string;
  steps?: string[];
  primaryAction?: GuidanceAction;
  secondaryAction?: GuidanceAction;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[min(var(--radius-3xl),24px)] border border-dashed border-border bg-muted/15 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <FileText className="size-5" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {steps && steps.length > 0 ? (
        <ol className="mt-6 w-full max-w-lg space-y-2 text-left text-sm text-muted-foreground">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {primaryAction?.href ? (
          <Link
            href={primaryAction.href}
            className={buttonVariants({ size: "lg" })}
          >
            {primaryAction.label}
            <ArrowRight className="size-4" />
          </Link>
        ) : primaryAction?.onClick ? (
          <Button type="button" size="lg" onClick={primaryAction.onClick}>
            {primaryAction.label}
            <ArrowRight className="size-4" />
          </Button>
        ) : null}

        {secondaryAction?.href ? (
          <Link
            href={secondaryAction.href}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {secondaryAction.label}
          </Link>
        ) : secondaryAction?.onClick ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("stat-card", highlight && "stat-card--highlight")}>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {sublabel ? <div className="stat-card__sublabel">{sublabel}</div> : null}
    </div>
  );
}

export function DataTableShell({
  children,
  empty,
  isEmpty,
  scrollable,
  maxHeight,
}: {
  children: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
  scrollable?: boolean;
  /** e.g. "22rem" — only applies when scrollable */
  maxHeight?: string;
}) {
  return (
    <div
      className={cn("data-table", scrollable && "data-table--scrollable")}
      style={
        scrollable && maxHeight
          ? ({ "--data-table-max-h": maxHeight } as React.CSSProperties)
          : undefined
      }
    >
      {isEmpty ? (
        <div className="data-table__empty">{empty ?? "No records found."}</div>
      ) : (
        <div className="data-table__viewport">{children}</div>
      )}
    </div>
  );
}
