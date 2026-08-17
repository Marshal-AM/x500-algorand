import { toast } from "sonner";

type ToastOptions = {
  description?: string;
  duration?: number;
};

function asOptions(options?: ToastOptions | string): ToastOptions | undefined {
  if (typeof options === "string") return { description: options };
  return options;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const appToast = {
  success(title: string, options?: ToastOptions | string) {
    const opts = asOptions(options);
    toast.success(title, {
      description: opts?.description,
      duration: opts?.duration ?? 4500,
    });
  },
  error(title: string, description?: string | unknown) {
    toast.error(title, {
      description:
        typeof description === "string"
          ? description
          : description != null
            ? message(description)
            : undefined,
      duration: 6000,
    });
  },
  warning(title: string, options?: ToastOptions | string) {
    const opts = asOptions(options);
    toast.warning(title, {
      description: opts?.description,
      duration: opts?.duration ?? 5500,
    });
  },
  info(title: string, options?: ToastOptions | string) {
    const opts = asOptions(options);
    toast.info(title, {
      description: opts?.description,
      duration: opts?.duration ?? 4500,
    });
  },
};
