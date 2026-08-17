"use client";

import { useEffect } from "react";
import { appToast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    appToast.error("Could not load this page", error.message);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Something went wrong
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        We could not reach the indexer. Check your connection and try again.
      </p>
      <Button type="button" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
