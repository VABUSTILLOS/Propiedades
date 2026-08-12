import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { Bath, BedDouble, Ruler } from "lucide-react";
import type { PropertiesRow } from "@/modules/lib/database.types";

/**
 * Public property card for the homepage featured grid.
 * Server-safe (no state, no event handlers).
 */
export function PropertyCard({ listing }: { listing: PropertiesRow }) {
  const price =
    listing.price > 0
      ? `$${listing.price.toLocaleString()} ${listing.currency ?? "MXN"}`
      : "Precio por cotizar";

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
          <Badge className="rounded-full shadow-sm">
            {listing.type === "rent" ? "Renta" : "Venta"}
          </Badge>
        </div>
        <ScoreBadge
          score={listing.property_score}
          solid
          className="absolute right-3 top-3 rounded-full"
        />
      </div>

      <div className="space-y-1.5 pt-3">
        <h3 className="line-clamp-1 font-semibold leading-snug group-hover:underline">
          {listing.title}
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {listing.colonia}, {listing.city}
        </p>
        <p className="pt-1 text-lg font-bold">{price}</p>

        {(listing.recamaras != null ||
          listing.banos != null ||
          listing.construccion_m2 > 0) && (
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
            {listing.construccion_m2 > 0 && (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-4" />
                {listing.construccion_m2.toLocaleString()} m²
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
