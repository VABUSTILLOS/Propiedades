import Link from "next/link";
import { ArrowDownRight, MapPin } from "lucide-react";

import { ScoreBadge } from "@/components/ui/score-badge";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import { formatMxn } from "@/modules/lib/real-estate";
import type { ListingWithHot } from "@/modules/search/queries";

/**
 * "Deal of the week" spotlight floating in the hero's right column. Shows
 * the #1 opportunity with the proof portals never publish: the colonia
 * benchmark price struck through next to the real price, the exact %
 * advantage and the opportunity gauge. Server-safe (no state).
 */
export function HeroDealCard({ listing }: { listing: ListingWithHot }) {
  const discount =
    listing.discountPct != null && listing.discountPct > 0
      ? listing.discountPct
      : null;
  // Reconstruct the colonia benchmark price from the computed discount.
  const benchmarkPrice =
    discount != null ? Math.round(listing.price / (1 - discount / 100)) : null;

  return (
    <Link
      href={`/property/${listing.slug}`}
      className="group relative block overflow-hidden rounded-[2rem] bg-card text-card-foreground shadow-2xl shadow-black/50 transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[16/10] bg-muted">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            Sin foto
          </div>
        )}
        <div className="absolute left-4 top-4">
          <span className="rounded-full bg-black/55 px-3 py-1 font-mono text-xs font-medium uppercase tracking-[0.2em] text-white backdrop-blur-sm">
            Oportunidad Nº 1
          </span>
        </div>
        <ScoreBadge
          score={listing.property_score}
          solid
          className="absolute right-4 top-4 rounded-full"
        />
        {discount != null && <VerificationSeal discountPct={discount} />}
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        <div>
          <h3 className="line-clamp-1 font-semibold leading-snug group-hover:underline">
            {listing.title}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="line-clamp-1">
              {[listing.colonia, listing.city].filter(Boolean).join(" · ")}
            </span>
          </p>
        </div>

        <div>
          {benchmarkPrice != null && (
            <p className="font-mono text-xs text-muted-foreground">
              Valor de colonia{" "}
              <span className="line-through">{formatMxn(benchmarkPrice)}</span>
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <p className="text-2xl font-bold tracking-tight">
              {formatMxn(listing.price)}
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                {listing.currency ?? "MXN"}
              </span>
            </p>
            {discount != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <ArrowDownRight className="size-3.5" aria-hidden />
                {discount.toFixed(1)}% vs colonia
              </span>
            )}
          </div>
        </div>

        <HotnessGauge score={listing.hotScore} className="pt-1" />
      </div>
    </Link>
  );
}

/**
 * Rotating verification seal over the photo — the registry's "stamp".
 * SVG text ring on a slow 20s rotation; the global reduced-motion rule
 * collapses it to a static seal for users who prefer less motion.
 */
function VerificationSeal({ discountPct }: { discountPct: number }) {
  return (
    <div className="absolute bottom-4 right-4 size-24 drop-shadow-lg">
      <svg
        viewBox="0 0 100 100"
        className="size-full animate-[spin_20s_linear_infinite]"
        aria-hidden
      >
        <defs>
          <path
            id="verification-seal-circle"
            d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
          />
        </defs>
        <circle cx="50" cy="50" r="50" className="fill-[#180F08]" />
        <circle
          cx="50"
          cy="50"
          r="26"
          className="fill-none stroke-white/20"
          strokeWidth="0.75"
        />
        <text
          className="fill-[#FBF6F0] font-mono text-[9px] uppercase"
          style={{ letterSpacing: "0.16em" }}
        >
          <textPath
            href="#verification-seal-circle"
            textLength="224"
            lengthAdjust="spacing"
          >
            Analizada vs colonia · Verificada ·
          </textPath>
        </text>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-[#7BC796]">
        −{discountPct.toFixed(0)}%
      </span>
    </div>
  );
}
