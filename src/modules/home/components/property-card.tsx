import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { Bath, BedDouble, MapPin, Ruler } from "lucide-react";
import type { PropertiesRow } from "@/modules/lib/database.types";
import { CardFavoriteButton } from "@/modules/home/components/card-favorite-button";

/**
 * Public property card for the homepage featured grid.
 * Server-safe (no state, no event handlers); the favorite bookmark
 * is a separate client component embedded over the image.
 */
export function PropertyCard({
  listing,
  saved = false,
}: {
  listing: PropertiesRow;
  /** Whether the current user already saved this property as a favorite. */
  saved?: boolean;
}) {
  const price =
    listing.price > 0
      ? `$${listing.price.toLocaleString()} ${listing.currency ?? "MXN"}`
      : "Precio por cotizar";

  // Land (terreno) is inferred: no constructed area, but plot area present.
  const isLand = listing.terreno_m2 > 0 && listing.construccion_m2 === 0;

  const typeLabel = isLand ? "Tierra" : listing.type === "rent" ? "Renta" : "Venta";

  return (
    <Link
      href={`/property/${listing.slug}`}
      className="group block motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
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
      </div>
    </Link>
  );
}

