import type { ReactNode } from "react";
import Link from "next/link";
import { algorandTxExplorerUrl, shortenTxId } from "@/lib/indexer";
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      data-slot="table"
      className={cn("data-table__table w-full caption-bottom text-left", className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      data-slot="table-header"
      className={cn("data-table__head", className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("divide-y divide-border/60", className)}
      {...props}
    />
  );
}

export function TableRow({
  className,
  interactive,
  animate,
  style,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & {
  interactive?: boolean;
  animate?: boolean;
}) {
  return (
    <tr
      data-slot="table-row"
      style={style}
      className={cn(
        interactive && "data-table__row--interactive",
        animate && "data-table__row--animate",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right";
}) {
  return (
    <th
      data-slot="table-head"
      className={cn(align === "right" && "text-right", className)}
      {...props}
    />
  );
}

export function TableCell({
  className,
  align = "left",
  mono,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right";
  mono?: boolean;
}) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "text-foreground tabular-nums",
        align === "right" && "text-right",
        mono && "font-mono text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function TableLink({
  href,
  children,
  mono,
  external,
}: {
  href: string;
  children: ReactNode;
  mono?: boolean;
  external?: boolean;
}) {
  const className = cn(
    "font-medium text-primary no-underline hover:text-primary/80 hover:no-underline",
    mono && "font-mono text-xs",
  );
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function AlgorandTxLink({ txId }: { txId: string }) {
  return (
    <TableLink
      href={algorandTxExplorerUrl(txId)}
      mono
      external
    >
      {shortenTxId(txId)}
    </TableLink>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "success" &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        tone === "warning" &&
          "border-amber-500/20 bg-amber-500/10 text-amber-400",
        tone === "danger" &&
          "border-red-500/20 bg-red-500/10 text-red-400",
        tone === "info" && "border-blue-500/20 bg-blue-500/10 text-blue-400",
        tone === "neutral" &&
          "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
