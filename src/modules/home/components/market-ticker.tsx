import Link from "next/link";

export type TickerItem = { label: string; href: string };

/**
 * Live activity ticker — ambient proof that the registry keeps moving.
 * Real listings in mono uppercase, each linked to its property page; the
 * loop pauses on hover (so items stay clickable) and collapses to a static
 * strip under reduced-motion (global accessibility rule).
 * Server-safe: items arrive pre-formatted from the page.
 */
export function MarketTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;

  const half = (duplicate: boolean) => (
    <div
      aria-hidden={duplicate || undefined}
      className="flex shrink-0 items-center"
    >
      {items.map((item, i) => (
        <span key={`${duplicate ? "b" : "a"}-${i}`} className="flex items-center">
          <Link
            href={item.href}
            tabIndex={duplicate ? -1 : undefined}
            className="px-6 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            {item.label}
          </Link>
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
