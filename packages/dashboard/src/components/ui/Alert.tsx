import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Alert({
  variant = "default",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive" | "success" | "warning";
}) {
  const Icon =
    variant === "destructive"
      ? AlertCircle
      : variant === "success"
        ? CheckCircle2
        : Info;

  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
        variant === "destructive" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        variant === "success" &&
          "border-success/30 bg-success/10 text-success",
        variant === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-400",
        variant === "default" &&
          "border-border bg-muted/40 text-foreground",
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
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
    <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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

export function SectionTitle({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">
      {children}
      {count != null && (
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({count})
        </span>
      )}
    </h2>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
      {children}
    </code>
  );
}
