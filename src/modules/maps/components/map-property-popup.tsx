"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bath,
  BedDouble,
  Car,
  ChevronLeft,
  ChevronRight,
  ListPlus,
  MapPin,
  Ruler,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/modules/lib/real-estate";
import { CardFavoriteButton } from "@/modules/home/components/card-favorite-button";
import { AddToListDialog } from "@/modules/favorites/components/add-to-list-dialog";
import type { FavoriteListWithMeta } from "@/modules/favorites/lists-queries";
import type { PropertyMapMarker } from "@/modules/search/queries";

/** Subset of `/api/properties/[slug]/panel` the popup actions need. */
type PopupPanelData = {
  isSaved: boolean;
  lists: FavoriteListWithMeta[];
  containingListIds: string[];
};

/**
 * Vivanuncios-style mini listing card anchored above a map pin: photo
 * carousel (arrows + swipe + counter) plus the essential facts. Everything
 * except the carousel controls and the close button links to the listing.
 */
export function MapPropertyPopup({
  marker,
  from,
  onClose,
}: {
  marker: PropertyMapMarker;
  /** Full URL of the current list/search view so the detail page can link back. */
  from?: string;
  onClose: () => void;
}) {
  const images = marker.images ?? [];
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [slide, setSlide] = useState(0);
  const [panelResult, setPanelResult] = useState<
    | { slug: string; data: PopupPanelData }
    | { slug: string; failed: true }
    | null
  >(null);

  // Favorite/list membership is user-specific — fetch it lazily from the
  // same panel endpoint the split detail view uses. Keyed by slug so a
  // stale result from a previously selected property is never shown.
  useEffect(() => {
    const slug = marker.slug;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/properties/${slug}/panel`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as PopupPanelData;
        if (!cancelled) setPanelResult({ slug, data: json });
      } catch {
        if (!cancelled) setPanelResult({ slug, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marker.slug]);

  const panel =
    panelResult && "data" in panelResult && panelResult.slug === marker.slug
      ? panelResult.data
      : null;
  const panelFailed =
    !!panelResult && "failed" in panelResult && panelResult.slug === marker.slug;

  const href = from
    ? `/property/${marker.slug}?from=${encodeURIComponent(from)}`
    : `/property/${marker.slug}`;

  const scrollTo = (index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const next = Math.max(0, Math.min(images.length - 1, index));
    scroller.scrollTo({ left: next * scroller.clientWidth, behavior: "smooth" });
  };

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    setSlide(Math.round(scroller.scrollLeft / scroller.clientWidth));
  };

  const location = [marker.colonia, marker.city].filter(Boolean).join(", ");
  const hasSpecs =
    marker.recamaras != null ||
    marker.banos != null ||
    marker.estacionamientos != null ||
    marker.construccion_m2 > 0 ||
    marker.terreno_m2 > 0;

  return (
    <div className="w-72 overflow-hidden rounded-2xl border bg-background shadow-xl">
      <div className="relative aspect-[4/3] bg-muted">
        {images.length > 0 ? (
          <>
            <Link href={href} tabIndex={-1} aria-label={marker.title}>
              <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="flex size-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    src={src}
                    alt={`${marker.title} — foto ${i + 1}`}
                    draggable={false}
                    className="size-full shrink-0 snap-center object-cover"
                  />
                ))}
              </div>
            </Link>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Foto anterior"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scrollTo(slide - 1);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-1 shadow transition-colors hover:bg-background"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Foto siguiente"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scrollTo(slide + 1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-1 shadow transition-colors hover:bg-background"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                  {slide + 1}/{images.length}
                </span>
              </>
            )}
          </>
        ) : (
          <Link
            href={href}
            className="flex size-full items-center justify-center text-xs text-muted-foreground"
          >
            Sin foto
          </Link>
        )}
        <button
          type="button"
          aria-label="Cerrar"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-2 top-2 rounded-full bg-background/90 p-1 shadow transition-colors hover:bg-background"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <Badge className="absolute left-2 top-2 rounded-full shadow-sm">
          {CATEGORY_LABELS[marker.category]}
        </Badge>
      </div>

      <Link href={href} className="block space-y-1 p-3">
        <p className="font-bold">
          ${marker.price.toLocaleString()}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {marker.currency} · {marker.type === "rent" ? "renta" : "venta"}
          </span>
        </p>
        <p className="line-clamp-1 text-sm font-semibold leading-snug">
          {marker.title}
        </p>
        {location && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{location}</span>
          </p>
        )}
        {hasSpecs && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
            {marker.recamaras != null && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="size-3.5" aria-hidden="true" />
                {marker.recamaras}
              </span>
            )}
            {marker.banos != null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="size-3.5" aria-hidden="true" />
                {marker.banos}
              </span>
            )}
            {marker.estacionamientos != null && (
              <span className="inline-flex items-center gap-1">
                <Car className="size-3.5" aria-hidden="true" />
                {marker.estacionamientos}
              </span>
            )}
            {marker.construccion_m2 > 0 && (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-3.5" aria-hidden="true" />
                {marker.construccion_m2.toLocaleString()} m² constr.
              </span>
            )}
            {marker.terreno_m2 > 0 && (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-3.5" aria-hidden="true" />
                {marker.terreno_m2.toLocaleString()} m² terreno
              </span>
            )}
          </div>
        )}
      </Link>

      {/* Favorite / list actions — outside the Link so they don't navigate. */}
      {!panelFailed ? (
        <div className="flex items-center justify-end gap-2 px-3 pb-3">
          {panel ? (
            <>
              <CardFavoriteButton
                propertyId={marker.id}
                propertySlug={marker.slug}
                initialSaved={panel.isSaved}
              />
              <AddToListDialog
                propertyId={marker.id}
                propertySlug={marker.slug}
                lists={panel.lists}
                containingListIds={panel.containingListIds}
                trigger={
                  <button
                    type="button"
                    aria-label="Guardar en una lista"
                    title="Guardar en una lista"
                    className="flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/5 transition hover:bg-white"
                  >
                    <ListPlus className="size-4 text-muted-foreground" />
                  </button>
                }
              />
            </>
          ) : (
            <>
              <span className="size-9 animate-pulse rounded-full bg-muted" />
              <span className="size-9 animate-pulse rounded-full bg-muted" />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
