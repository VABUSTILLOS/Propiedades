import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Image as ImageIcon } from "lucide-react";

import { formatMxn } from "@/modules/lib/real-estate";
import type { ListingWithHot } from "@/modules/search/queries";
import { FolioLabel } from "@/modules/home/components/folio-label";

/**
 * The weekly ranking: a numbered ledger of the opportunities that beat
 * their colonia the most, ordered by hot score. A ledger (not cards) on
 * purpose — rank and delta scan faster than a grid, and the numbered-file
 * look is the registry's signature. Server-safe.
 */
export function OpportunityLedger({ items }: { items: ListingWithHot[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <FolioLabel index="01" title="Registro semanal" />
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
              El <em className="font-display italic">ranking</em> de la semana
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Las {items.length} propiedades que más superan a su colonia,
              ordenadas por score de oportunidad. Se recalcula con cada análisis.
            </p>
          </div>
          <Link
            href="/search?sortBy=hot"
            className="group inline-flex shrink-0 items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-primary"
          >
            Registro completo
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <ol className="border-t border-border">
          {items.map((listing, i) => (
            <li key={listing.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/property/${listing.slug}`}
                className="group grid grid-cols-[2.25rem_3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-muted/70 sm:grid-cols-[3.5rem_4.5rem_minmax(0,1fr)_9.5rem_8.5rem_1.5rem] sm:gap-6 sm:py-5"
              >
                <span className="font-mono text-lg text-muted-foreground transition-colors group-hover:text-primary sm:text-2xl">
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Thumbnail of the property's main photo */}
                <span className="block size-12 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-14">
                  {listing.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      loading="lazy"
                      decoding="async"
                      src={listing.images[0]}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center">
                      <ImageIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                    </span>
                  )}
                </span>

                <span className="min-w-0">
                  <span className="line-clamp-1 block font-semibold">
                    {listing.title}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {[listing.colonia, listing.city].filter(Boolean).join(" · ") ||
                      "México"}
                  </span>
                </span>

                {/* Mobile: price + delta stacked */}
                <span className="block whitespace-nowrap text-right sm:hidden">
                  <span className="block font-mono text-sm font-semibold">
                    {formatMxn(listing.price)}
                  </span>
                  <Delta discountPct={listing.discountPct} small />
                </span>

                {/* Desktop columns */}
                <span className="hidden sm:block">
                  <Delta discountPct={listing.discountPct} />
                </span>
                <span className="hidden text-right font-mono text-sm font-semibold sm:block">
                  {formatMxn(listing.price)}
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="hidden size-5 text-muted-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary sm:block"
                />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Delta vs the colonia benchmark. Positive = below benchmark (advantage). */
function Delta({
  discountPct,
  small = false,
}: {
  discountPct: number | null;
  small?: boolean;
}) {
  if (discountPct == null) {
    return (
      <span
        className={`font-mono text-muted-foreground ${small ? "text-xs" : "text-sm"}`}
      >
        —
      </span>
    );
  }

  const below = discountPct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-semibold ${
        small ? "text-xs" : "text-sm"
      } ${below ? "text-emerald-600" : "text-amber-600"}`}
    >
      {below ? (
        <ArrowDownRight className="size-3.5" aria-hidden />
      ) : (
        <ArrowUpRight className="size-3.5" aria-hidden />
      )}
      {below ? "−" : "+"}
      {Math.abs(discountPct).toFixed(1)}%
      {!small && (
        <span className="ml-1 font-normal text-muted-foreground">
          {below ? "vs colonia" : "sobre colonia"}
        </span>
      )}
    </span>
  );
}
