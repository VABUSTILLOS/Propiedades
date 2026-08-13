"use client";

import Link from "next/link";
import { ArrowLeft, Bath, BedDouble, Car, MapPin, Ruler } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { CardFavoriteButton } from "@/modules/home/components/card-favorite-button";
import { WhatsAppInquiryButton } from "@/modules/chat/components/whatsapp-inquiry-button";
import type { ListingWithHot } from "@/modules/search/queries";
import { cn } from "@/lib/utils";

/**
 * Compact "tablet-style" listing detail that replaces the results list in the
 * left pane of the split view when a card is selected, so the map stays
 * visible on the right. Mirrors the full `/property/[slug]` page in a single
 * scrollable column: photo, type badge, title, location, price, features,
 * short description, WhatsApp inquiry and a link to the full listing page.
 */
export function SplitDetailPanel({
  listing,
  onClose,
  className,
}: {
  listing: ListingWithHot;
  /** Clears the selection and restores the results list. */
  onClose: () => void;
  className?: string;
}) {
  // Land (terreno) is inferred: no constructed area, but plot area present.
  const isLand = listing.terreno_m2 > 0 && listing.construccion_m2 === 0;

  const typeLabel = isLand
    ? "Tierra"
    : listing.type === "rent"
      ? "Renta"
      : "Venta";

  const price =
    listing.price > 0
      ? `$${listing.price.toLocaleString()} ${listing.currency ?? "MXN"}`
      : "Precio por cotizar";

  const location = [
    listing.address,
    listing.colonia,
    listing.city,
    listing.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-background", className)}>
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            Sin foto
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge className="rounded-full shadow-sm">{typeLabel}</Badge>
          <ScoreBadge
            score={listing.property_score}
            solid
            className="rounded-full shadow-sm"
          />
        </div>
        <div className="absolute bottom-3 right-3">
          <CardFavoriteButton
            propertyId={listing.id}
            propertySlug={listing.slug}
            initialSaved={false}
          />
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a resultados
        </button>

        <div className="space-y-1.5">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug">
            {listing.title}
          </h3>
          <p className="inline-flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{location}</span>
          </p>
        </div>

        <p className="text-2xl font-bold">{price}</p>

        {(listing.recamaras != null ||
          listing.banos != null ||
          listing.estacionamientos != null ||
          listing.construccion_m2 > 0 ||
          isLand) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {listing.recamaras != null && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="size-4" aria-hidden="true" />
                {listing.recamaras} rec.
              </span>
            )}
            {listing.banos != null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="size-4" aria-hidden="true" />
                {listing.banos} baños
              </span>
            )}
            {listing.estacionamientos != null && (
              <span className="inline-flex items-center gap-1">
                <Car className="size-4" aria-hidden="true" />
                {listing.estacionamientos} est.
              </span>
            )}
            {isLand ? (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-4" aria-hidden="true" />
                {listing.terreno_m2.toLocaleString()} m² terreno
              </span>
            ) : (
              listing.construccion_m2 > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="size-4" aria-hidden="true" />
                  {listing.construccion_m2.toLocaleString()} m² constr.
                </span>
              )
            )}
          </div>
        )}

        {listing.description && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
              {listing.description}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <WhatsAppInquiryButton
            title={listing.title}
            colonia={listing.colonia}
            city={listing.city}
            className="w-full px-4 py-2.5 text-sm"
          />
          <Link
            href={`/property/${listing.slug}`}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#C4571D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D67E3C]"
          >
            Ver propiedad completa
          </Link>
        </div>
      </div>
    </div>
  );
}
