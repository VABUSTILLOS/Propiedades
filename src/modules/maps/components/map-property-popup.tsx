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
import { AdminGalleryEditor } from "@/modules/admin/components/admin-gallery-editor";
import { CATEGORY_LABELS } from "@/modules/lib/real-estate";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
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
 * carousel (arrows + swipe + counter) plus the essential facts. The
 * listing opens ONLY from a deliberate press in the middle of the photo:
 * while browsing house to house, swipes and taps on the photo's edges or
 * on the text must never yank the user out of the map flow.
 */
export function MapPropertyPopup({
  marker,
  from,
  onClose,
  canModerate = false,
  onImagesChange,
}: {
  marker: PropertyMapMarker;
  /** Full URL of the current list/search view so the detail page can link back. */
  from?: string;
  onClose: () => void;
  /** Master user: show the gallery editor so the cover photo and the
   *  photo order can be fixed right from the map card. */
  canModerate?: boolean;
  /** Keeps the map marker (and this card's carousel) in sync with the
   *  gallery editor's changes. */
  onImagesChange?: (images: string[]) => void;
}) {
  const images = marker.images ?? [];
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollStartRef = useRef(0);
  const [slide, setSlide] = useState(0);

  // Google Maps listens for drags at the map-container level, so a
  // gesture that starts on the popup would pan the map instead of
  // scrolling the photo strip. Native listeners on the popup root (they
  // run before the event reaches the map's own handlers) keep every
  // gesture that starts on the popup for the popup.
  //
  // The pointerdown handler also records the strip's scroll position:
  // because it stops propagation natively, React's own onPointerDown
  // (dispatched from the root listener) never fires — recording the
  // swipe start here is the only reliable place. Without it the
  // click-after-swipe guard below compared against a stale 0 and ate
  // every arrow click after the first photo change.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    const onPointerDown = (e: Event) => {
      scrollStartRef.current = scrollerRef.current?.scrollLeft ?? 0;
      stop(e);
    };
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    const events = ["touchstart", "touchmove", "wheel"];
    for (const type of events) {
      el.addEventListener(type, stop, { passive: true });
    }
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      for (const type of events) {
        el.removeEventListener(type, stop);
      }
    };
  }, []);
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
    <div
      ref={rootRef}
      className="w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-background shadow-xl"
    >
      <div
        className="relative aspect-[4/3] bg-muted"
        onClickCapture={(e) => {
          // A click fired at the end of a photo swipe is not a visit:
          // the strip scrolled since pointerdown, so swallow it before
          // the wrapping link navigates to the listing.
          const scroller = scrollerRef.current;
          if (
            scroller &&
            Math.abs(scroller.scrollLeft - scrollStartRef.current) > 8
          ) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Buttons (carousel arrows, close) handle their own clicks.
          if ((e.target as HTMLElement).closest("button")) return;
          // Only a deliberate press in the middle of the photo opens the
          // listing; taps on the edges while browsing stay on the map.
          const rect = e.currentTarget.getBoundingClientRect();
          const fx = (e.clientX - rect.left) / rect.width;
          const fy = (e.clientY - rect.top) / rect.height;
          if (fx < 0.25 || fx > 0.75 || fy < 0.25 || fy > 0.75) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {images.length > 0 ? (
          <>
            <Link href={href} tabIndex={-1} aria-label={marker.title}>
              <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="flex size-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {images.map((src, i) => (
                  <div
                    key={src}
                    className="relative size-full shrink-0 snap-center overflow-hidden"
                  >
                    {/* Blurred fill behind the photo: the same image,
                        cover-cropped and blurred, so the space around
                        the full photo looks intentional instead of flat
                        letterbox bars. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-md"
                    />
                    {/* The photo itself is shown whole (object-contain),
                        never cropped, whatever its aspect ratio. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding="async"
                      src={src}
                      alt={`${marker.title} — foto ${i + 1}`}
                      draggable={false}
                      className="absolute inset-0 size-full object-contain"
                    />
                  </div>
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
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            Sin foto
          </div>
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

      {/* Facts are plain text now: the only way into the listing is the
          deliberate press in the middle of the photo above. */}
      <div className="block space-y-1 p-3">
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
      </div>

      {/* Opportunity score bar — the same one the cards and the full
          listing show; "Sin dato" when there is no score yet. */}
      <div className="px-3 pb-2">
        <HotnessGauge score={marker.hotScore ?? null} />
      </div>

      {/* Master only: fix the cover photo / gallery order right here,
          without leaving the map browsing flow. */}
      {canModerate && (
        <div className="flex items-center justify-end px-3 pb-2">
          <AdminGalleryEditor
            propertyId={marker.id}
            propertySlug={marker.slug}
            initialImages={marker.images ?? []}
            onImagesChange={onImagesChange}
          />
        </div>
      )}

      {/* Favorite / list actions. */}
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
