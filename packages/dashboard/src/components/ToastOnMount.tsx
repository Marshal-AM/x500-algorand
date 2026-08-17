"use client";

import { useEffect } from "react";
import { appToast } from "@/lib/toast";

export function ToastOnMount({
  variant,
  title,
  description,
}: {
  variant: "error" | "warning" | "info";
  title: string;
  description?: string;
}) {
  useEffect(() => {
    if (variant === "error") appToast.error(title, description);
    else if (variant === "warning") appToast.warning(title, { description });
    else appToast.info(title, { description });
  }, [variant, title, description]);

  return null;
}
