"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const emptySubscribe = () => () => {};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: "md" | "lg" | "xl";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onDialogClose = () => onClose();
    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener("close", onDialogClose);
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("close", onDialogClose);
      dialog.removeEventListener("cancel", onCancel);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className={cn(
        "app-dialog w-[min(100%,calc(100vw-2rem))] max-h-[min(88dvh,52rem)] border-0 bg-transparent p-0 shadow-none",
        size === "md" && "max-w-lg",
        size === "lg" && "max-w-3xl",
        size === "xl" && "max-w-5xl",
        className,
      )}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
    >
      <div className="flex max-h-[min(88dvh,52rem)] w-full flex-col overflow-hidden rounded-[min(var(--radius-3xl),24px)] border border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/80 px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <h2
              id="dialog-title"
              className="font-heading text-lg font-semibold text-foreground sm:text-xl"
            >
              {title}
            </h2>
            {description ? (
              <div className="text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-xl"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
