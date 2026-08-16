import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bath,
  BedDouble,
  MapPin,
  Ruler,
} from "lucide-react";
import type { PropertiesRow } from "@/modules/lib/database.types";
import { CardFavoriteButton } from "@/modules/home/components/card-favorite-button";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
  getPrecioM2Const,
  getPrecioM2Terreno,
  isLandListing,
  propertyTypeLabel,
} from "@/modules/lib/real-estate";

/**
 * Public property card for the homepage featured grid and the listados
 * grid. Server-safe (no state, no event handlers); the favorite bookmark
 * is a separate client component embedded over the image.
 *
 * `showDetails` reveals the optional financial details (predial est.,
 * escrituración est., barra hot, $/m², % descuento vs colonia) that the
 * listing pages toggle on/off; the homepage keeps them hidden.
 */
export function PropertyCard({
  listing,
  saved = false,
  hotScore = null,
  discountPct = null,
  showDetails = false,
  from,
}: {
  listing: PropertiesRow;
  /** Whether the current user already saved this property as a favorite. */
  saved?: boolean;
  /** Hotness 0–100 for the traffic-light gauge (only when showDetails). */
  hotScore?: number | null;
  /** Percent below (positive) or above (negative) the colonia benchmark. */
  discountPct?: number | null;
  /** Whether to render the extra financial details on the card. */
  showDetails?: boolean;
  /** Full URL of the current list/search view so the detail page can link back. */
  from?: string;
}) {
  const price =
    listing.price > 0
      ? `$${listing.price.toLocaleString()} ${listing.currency ?? "MXN"}`
      : "Precio por cotizar";

  // Land (terreno) is inferred: no constructed area, but plot area present.
  const isLand = isLandListing(listing);

  const typeLabel = propertyTypeLabel(listing.type, isLand);

  const precioM2Const = getPrecioM2Const(listing) ?? 0;
  const precioM2Terreno = getPrecioM2Terreno(listing) ?? 0;

  const href = from
    ? `/property/${listing.slug}?from=${encodeURIComponent(from)}`
    : `/property/${listing.slug}`;

  return (
    <div className="group block motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md">
      <Link href={href} className="block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            loading="lazy"
            decoding="async"
            src={listing.images[0]}
            alt={listing.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            Sin foto
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge className="rounded-full shadow-sm">{typeLabel}</Badge>
        </div>
        <ScoreBadge
          score={listing.property_score}
          solid
          className="absolute right-3 top-3 rounded-full"
        />
        <div className="absolute bottom-3 right-3">
          <CardFavoriteButton
            propertyId={listing.id}
            propertySlug={listing.slug}
            initialSaved={saved}
          />
        </div>
      </div>

      <div className="space-y-1.5 pt-3">
        <h3 className="line-clamp-1 font-semibold leading-snug group-hover:underline">
          {listing.title}
        </h3>
        <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="line-clamp-1">
            {listing.colonia ? `${listing.colonia}, ` : ""}
            {listing.city}
          </span>
        </p>
        <p className="pt-1 text-lg font-bold">{price}</p>

        {(listing.recamaras != null ||
          listing.banos != null ||
          listing.construccion_m2 > 0 ||
          isLand) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
            {listing.recamaras != null && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="size-4" />
                {listing.recamaras}
              </span>
            )}
            {listing.banos != null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="size-4" />
                {listing.banos}
              </span>
            )}
            {isLand ? (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-4" />
                {listing.terreno_m2.toLocaleString()} m² terreno
              </span>
            ) : (
              listing.construccion_m2 > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="size-4" />
                  {listing.construccion_m2.toLocaleString()} m²
                </span>
              )
            )}
          </div>
        )}

        {showDetails && listing.price > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <HotnessGauge score={hotScore ?? null} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Predial est.</dt>
                <dd className="font-medium">
                  {formatMxn(estimatePredial(listing.price))}
                  <span className="text-muted-foreground">/año</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Escrituración est.</dt>
                <dd className="font-medium">
                  {formatMxn(estimateEscrituracion(listing.price))}
                </dd>
              </div>
              {precioM2Const > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">$/m² constr.</dt>
                  <dd className="font-medium">
                    ${Math.round(precioM2Const).toLocaleString()}
                  </dd>
                </div>
              )}
              {precioM2Terreno > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">$/m² terreno</dt>
                  <dd className="font-medium">
                    ${Math.round(precioM2Terreno).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
            {discountPct != null && (
              <p className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                Descuento vs colonia:
                {discountPct >= 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
                    <ArrowDownRight className="size-3.5" aria-hidden="true" />
                    {discountPct.toFixed(1)}% abajo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-amber-700 dark:text-amber-400">
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    {Math.abs(discountPct).toFixed(1)}% arriba
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>
      </Link>

    </div>
  );
}

