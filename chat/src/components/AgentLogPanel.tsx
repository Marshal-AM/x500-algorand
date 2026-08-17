"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderLogLine(line: string) {
  const parts = line.split(URL_PATTERN);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function AgentLogPanel({
  logs,
  className,
}: {
  logs: string[];
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div
      ref={viewportRef}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[min(var(--radius-3xl),20px)] border border-border/70 bg-[color-mix(in_oklch,var(--background)_55%,transparent)] p-4",
        className,
      )}
    >
      {logs.length === 0 ? (
        <div className="flex min-h-[12rem] flex-col items-center justify-center text-center text-sm text-muted-foreground">
          Agent logs will appear here when you send a message.
        </div>
      ) : (
        <pre className="m-0 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
          {logs.map((line, idx) => (
            <div key={`${idx}-${line.slice(0, 24)}`}>
              {renderLogLine(line)}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}
