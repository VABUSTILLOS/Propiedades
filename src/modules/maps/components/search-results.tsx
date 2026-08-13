"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map as MapIcon } from "lucide-react";

import {
  MapViewToggle,
  type MapView,
} from "@/modules/maps/components/map-view-toggle";
import { PropertiesMap } from "@/modules/maps/components/properties-map";
import { InfiniteListings } from "@/modules/maps/components/infinite-listings";
import { SplitDetailPanel } from "@/modules/maps/components/split-detail-panel";
import { boundsToString, type MapBounds } from "@/modules/lib/schemas";
import type { ListingWithHot, PropertyMapMarker } from "@/modules/search/queries";

/** Stable empty array so the map's effects don't rerun while pins load. */
const NO_MARKERS: PropertyMapMarker[] = [];

/**
 * Orchestrator for the Airbnb-style Lista ⇄ Mapa ⇄ Dividido experience.
 *
 * The parent (server page) remounts this with a `key` derived from the current
 * filters so navigation resets both the infinite list and the map:
 * - List mode → `InfiniteListings` over `GET /api/search`.
 * - Map mode → `PropertiesMap` with pins from `GET /api/search/markers`,
 *   plus the current bounded list below the map.
 * - Split mode (default) → listings on one half, sticky map on the other.
 *
 * View mode lives in the URL (`view=list|map|split`); the zone pill writes
 * `bounds=minLat,minLng,maxLat,maxLng` so the URL is shareable.
 */
export function SearchResults({
  initialItems,
  initialTotal,
  filtersQueryString,
  view = "split",
  initialBounds = null,
  card = "search",
  gridClassName,
  emptyState,
  basePath = "/search",
}: {
  initialItems: ListingWithHot[];
  initialTotal: number;
  /** Current filters (and bounds) as a URL query string, no leading `?`. */
  filtersQueryString: string;
  /** Presentation style: list-only, map-only, or the default split. */
  view?: MapView;
  initialBounds?: MapBounds | null;
  /** Which card to render for each listing (serializable across RSC). */
  card?: "search" | "property";
  gridClassName?: string;
  emptyState?: React.ReactNode;
  /** Base path for `router.push` when toggling view / applying a zone. */
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [markers, setMarkers] = useState<PropertyMapMarker[] | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ListingWithHot | null>(null);

  // The map shows every pin matching the current filters (bounds included),
  // so it always re-fetches when the URL changes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const qs = filtersQueryString
          ? `/api/search/markers?${filtersQueryString}`
          : "/api/search/markers";
        const res = await fetch(qs, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { markers?: PropertyMapMarker[] };
        if (!cancelled) setMarkers(data.markers ?? []);
      } catch {
        // Keep the previous pins; the map is a progressive enhancement.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtersQueryString]);

  const updateParam = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  };

  const list = (split = false) => (
    <InfiniteListings
      initialItems={initialItems}
      initialTotal={initialTotal}
      filtersQueryString={filtersQueryString}
      card={card}
      gridClassName={
        split
          ? "grid gap-x-4 gap-y-6 sm:grid-cols-2"
          : gridClassName
      }
      emptyState={emptyState}
      onCardHover={setHoveredId}
      onCardSelect={split ? setSelectedItem : undefined}
    />
  );

  // The map zooms to the selected listing's own coordinates, so the camera
  // works even when its pin is not in the fetched marker set. Rows that were
  // never geocoded fall back to (0,0) — for those, approximate the position
  // with the centroid of fetched markers in the same colonia and city.
  const focusPosition = useMemo(() => {
    if (!selectedItem) return null;
    if (!(selectedItem.lat === 0 && selectedItem.lng === 0)) {
      return { lat: selectedItem.lat, lng: selectedItem.lng };
    }
    const all = markers ?? [];
    const neighbors = all.filter(
      (m) =>
        m.colonia === selectedItem.colonia && m.city === selectedItem.city,
    );
    // No geocoded neighbor in the colonia: fall back to the city centroid.
    const pool = neighbors.length > 0
      ? neighbors
      : all.filter((m) => m.city === selectedItem.city);
    if (pool.length === 0) return null;
    return {
      lat: pool.reduce((sum, m) => sum + m.lat, 0) / pool.length,
      lng: pool.reduce((sum, m) => sum + m.lng, 0) / pool.length,
      approximate: true,
    };
  }, [selectedItem, markers]);

  const map = (heightClass: string) => (
    <PropertiesMap
      markers={markers ?? NO_MARKERS}
      initialBounds={initialBounds}
      activeBounds={initialBounds}
      onApplyBounds={(bounds) =>
        updateParam({ bounds: boundsToString(bounds) })
      }
      onResetBounds={() => updateParam({ bounds: null })}
      highlightedId={selectedItem?.id ?? hoveredId}
      focusId={selectedItem?.id ?? null}
      focusPosition={focusPosition}
      selectionId={selectedItem?.id ?? null}
      heightClass={heightClass}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <MapViewToggle
          view={view}
          onChange={(next) => updateParam({ view: next })}
          count={initialTotal}
        />
      </div>

      {view === "split" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 lg:order-1">
            {/* Keep the list mounted so infinite-scroll state survives; swap
                it for the compact detail pane while a card is selected. */}
            <div className={selectedItem ? "hidden" : undefined}>
              {list(true)}
            </div>
            {selectedItem && (
              /* Mobile: full-screen overlay so the panel scrolls within its
                 own layer instead of growing unbounded in the layout.
                 Desktop: stays in the left column with a capped height. */
              <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background lg:static lg:z-auto lg:overflow-visible lg:bg-transparent">
                <SplitDetailPanel
                  key={selectedItem.id}
                  listing={selectedItem}
                  onClose={() => setSelectedItem(null)}
                  className="min-h-full rounded-none border-0 lg:min-h-0 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:rounded-2xl lg:border"
                />
              </div>
            )}
          </div>
          <div className="lg:order-2 lg:sticky lg:top-6 lg:self-start">
            {map("h-[40vh] lg:h-[calc(100vh-11rem)]")}
          </div>
        </div>
      ) : view === "map" ? (
        <div className="space-y-8">
          {map("h-[60vh]")}

          <section className="space-y-4" aria-label="Propiedades en esta zona">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MapIcon className="size-5 text-primary" aria-hidden="true" />
              {initialTotal} propiedad{initialTotal === 1 ? "" : "es"} en esta
              zona
            </h2>
            {list()}
          </section>
        </div>
      ) : (
        list()
      )}
    </div>
  );
}

