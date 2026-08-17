"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  CHAT_MODE_LABELS,
  type ChatTestMode,
} from "@/lib/agent/constants";
import { cn } from "@/lib/utils";

const MODES = Object.keys(CHAT_MODE_LABELS) as ChatTestMode[];

export function TestModeSelect({
  value,
  onChange,
  disabled,
}: {
  value: ChatTestMode;
  onChange: (mode: ChatTestMode) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id="test-mode"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Test mode"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 text-sm font-medium text-foreground transition-colors",
          "hover:border-primary/30 hover:bg-muted/60",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-primary/30 bg-muted/60",
        )}
      >
        <span className="max-w-[12rem] truncate sm:max-w-none">
          {CHAT_MODE_LABELS[value]}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-labelledby="test-mode"
          className="absolute top-[calc(100%+0.5rem)] right-0 z-50 min-w-[15rem] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.75)] backdrop-blur-xl"
        >
          {MODES.map((mode) => {
            const selected = mode === value;
            return (
              <li key={mode} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(mode);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-foreground hover:bg-muted/50",
                  )}
                >
                  <span>{CHAT_MODE_LABELS[mode]}</span>
                  {selected ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
