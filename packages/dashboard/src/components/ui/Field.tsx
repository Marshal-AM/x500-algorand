import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Field({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      data-slot="field"
      className={cn("flex w-full flex-col gap-2", className)}
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="field-label"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

export function FieldDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-3 py-1 text-sm text-foreground transition-[color,box-shadow] placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
