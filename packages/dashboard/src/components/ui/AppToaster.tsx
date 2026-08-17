"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="top-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-2xl !border !shadow-xl !backdrop-blur-xl !text-sm !font-sans",
          title: "!text-sm !font-semibold",
          description: "!text-xs !opacity-90",
          closeButton:
            "!border-border !bg-card/80 !text-muted-foreground hover:!text-foreground",
          success:
            "!border-success/30 !bg-success/10 !text-success [&_[data-title]]:!text-success",
          error:
            "!border-destructive/30 !bg-destructive/10 !text-destructive [&_[data-title]]:!text-destructive",
          warning:
            "!border-amber-500/30 !bg-amber-500/10 !text-amber-300 [&_[data-title]]:!text-amber-300",
          info: "!border-primary/30 !bg-primary/10 !text-primary [&_[data-title]]:!text-primary",
        },
      }}
    />
  );
}
