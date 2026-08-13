import { cn } from "@/lib/utils";

const SIZES = {
  sm: "max-w-3xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
} as const;

export type PageShellSize = keyof typeof SIZES;

/**
 * Consistent page container: centered, horizontal padding, vertical rhythm.
 * Replaces the ad-hoc `mx-auto w-full max-w-* px-6 py-10` wrappers.
 */
export function PageShell({
  size = "lg",
  className,
  children,
}: {
  size?: PageShellSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-6 py-10", SIZES[size], className)}>
      {children}
    </div>
  );
}
