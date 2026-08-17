import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Cropped logo asset: 720×180px (purple mark + x500 wordmark). */
const LOGO_WIDTH = 720;
const LOGO_HEIGHT = 180;
const LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;

const VARIANTS = {
  nav: { height: 28, className: "h-6 w-auto max-w-[7.5rem] sm:max-w-[8.5rem]" },
  footer: { height: 22, className: "h-[1.375rem] w-auto max-w-[6.5rem]" },
} as const;

export function Logo({
  className,
  variant = "nav",
}: {
  className?: string;
  variant?: keyof typeof VARIANTS;
}) {
  const { height, className: sizeClass } = VARIANTS[variant];
  const width = Math.round(height * LOGO_ASPECT);

  return (
    <Link
      href="/"
      className={cn(
        "inline-flex shrink-0 items-center no-underline hover:opacity-90 hover:no-underline",
        className,
      )}
      aria-label="x500 home"
    >
      <Image
        src="/logo.png"
        alt="x500"
        width={width}
        height={height}
        priority={variant === "nav"}
        className={cn("object-contain object-left", sizeClass)}
      />
    </Link>
  );
}
