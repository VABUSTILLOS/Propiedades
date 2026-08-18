import { cn } from "@/lib/utils";

function hotnessLabel(score: number): string {
  if (score >= 70) return "Hot";
  if (score >= 40) return "Media";
  return "Fría";
}

/**
 * Opportunity traffic-light bar. Blue (cold, 0) → yellow → red (hot, 100).
 * The marker sits at the property's hotness score; a null score renders a
 * neutral "Sin dato" state. Always paired with text so the signal is not
 * color-only.
 */
export function HotnessGauge({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score == null) {
    return (
      <div
        className={cn("space-y-1", className)}
        aria-label="Sin dato de oportunidad"
      >
        <div className="h-2 w-full rounded-full bg-muted" />
        <p className="text-xs text-muted-foreground">Sin dato</p>
      </div>
    );
  }

  const clamped = Math.min(100, Math.max(0, score));
  const label = hotnessLabel(clamped);

  return (
    <div
      className={cn("space-y-1", className)}
      aria-label={`Oportunidad ${clamped} de 100 (${label})`}
    >
      <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500">
        <div
          className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 rounded-full bg-foreground shadow-sm ring-1 ring-white/70"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Fría</span>
        <span className="font-medium text-foreground">
          {clamped}/100 · {label}
        </span>
        <span>Hot</span>
      </div>
    </div>
  );
}
