/**
 * Live activity ticker — ambient proof that the registry keeps moving.
 * Real listings in mono uppercase; the loop pauses on hover and collapses
 * to a static strip under reduced-motion (global accessibility rule).
 * Server-safe: items arrive pre-formatted from the page.
 */
export function MarketTicker({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  const half = (duplicate: boolean) => (
    <div
      aria-hidden={duplicate || undefined}
      className="flex shrink-0 items-center"
    >
      {items.map((item, i) => (
        <span key={`${duplicate ? "b" : "a"}-${i}`} className="flex items-center">
          <span className="px-6">{item}</span>
          <span className="text-copper" aria-hidden>
            ◆
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="group overflow-hidden border-y border-white/10 bg-ink py-3.5 font-mono text-xs uppercase tracking-[0.18em] text-white/80">
      <div className="flex w-max animate-ticker group-hover:[animation-play-state:paused]">
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}
