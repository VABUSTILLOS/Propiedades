import { cn } from "@/lib/utils";

/**
 * Homepage-style keyword emphasis: Instrument Serif italic inside bold
 * headings. Inherits the parent's font-weight so the word renders bold,
 * matching the hero treatment ("vale la pena"). Use to highlight one
 * keyword per page title for a uniform voice across the site.
 */
export function Em({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <em className={cn("font-display font-bold italic", className)}>{children}</em>;
}
