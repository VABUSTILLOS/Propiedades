import { cn } from "@/lib/utils";

/**
 * Trust score pill. Colors communicate the score band at a glance:
 * emerald >= 8, amber >= 6.5, stone otherwise.
 */
export function ScoreBadge({
  score,
  className,
  solid = false,
}: {
  score: number | null;
  className?: string;
  /** White pill with fixed dark text — for overlays on top of photos. */
  solid?: boolean;
}) {
  if (score == null || score <= 0) return null;

  const tone = solid
    ? "bg-white text-neutral-900 shadow-sm"
    : score >= 80
      ? "bg-emerald-600/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400"
      : score >= 65
        ? "bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-400"
        : "bg-muted text-muted-foreground ring-border";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tone,
        className,
      )}
      aria-label={`Puntaje de confianza ${score.toFixed(1)} de 100`}
    >
      {score.toFixed(1)}
    </span>
  );
}
