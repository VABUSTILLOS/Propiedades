"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map as MapIcon } from "lucide-react";

import { MapViewToggle } from "@/modules/maps/components/map-view-toggle";
import { PropertiesMap } from "@/modules/maps/components/properties-map";
import { InfiniteListings } from "@/modules/maps/components/infinite-listings";
import { boundsToString, type MapBounds } from "@/modules/lib/schemas";
import type { ListingWithHot, PropertyMapMarker } from "@/modules/search/queries";

/**
 * Orchestrator for the Airbnb-style List ⇄ Mapa experience.
 *
 * The parent (server page) remounts this with a `key` derived from the current
 * filters so navigation resets both the infinite list and the map:
 * - List mode → `InfiniteListings` over `GET /api/search`.
 * - Map mode → `PropertiesMap` with pins from `GET /api/search/markers`,
 *   plus the current bounded list below the map.
 *
 * View mode lives in the URL (`mapSearch=true/false`); the zone pill writes
 * `bounds=minLat,minLng,maxLat,maxLng` so the URL is shareable.
 */
export function SearchResults({
  initialItems,
  initialTotal,
  filtersQueryString,
  mapSearch = false,
  initialBounds = null,
  renderCard,
  gridClassName,
  emptyState,
  basePath = "/search",
}: {
  initialItems: ListingWithHot[];
  initialTotal: number;
  /** Current filters (and bounds) as a URL query string, no leading `?`. */
  filtersQueryString: string;
  mapSearch?: boolean;
  initialBounds?: MapBounds | null;
  renderCard: (item: ListingWithHot) => React.ReactNode;
  gridClassName?: string;
  emptyState?: React.ReactNode;
  /** Base path for `router.push` when toggling map / applying a zone. */
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [markers, setMarkers] = useState<PropertyMapMarker[] | null>(null);

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

  const list = (
    <InfiniteListings
      initialItems={initialItems}
      initialTotal={initialTotal}
      filtersQueryString={filtersQueryString}
      renderCard={renderCard}
      gridClassName={gridClassName}
      emptyState={emptyState}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <MapViewToggle
          view={mapSearch ? "map" : "list"}
          onChange={(view) =>
            updateParam({ mapSearch: view === "map" ? "true" : null })
          }
          count={initialTotal}
        />
      </div>

      {mapSearch ? (
        <div className="space-y-8">
          <PropertiesMap
            markers={markers ?? []}
            initialBounds={initialBounds}
            activeBounds={initialBounds}
            onApplyBounds={(bounds) =>
              updateParam({
                bounds: boundsToString(bounds),
                mapSearch: "true",
              })
            }
            onResetBounds={() => updateParam({ bounds: null })}
          />

          <section className="space-y-4" aria-label="Propiedades en esta zona">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MapIcon className="size-5 text-[#C4571D]" aria-hidden="true" />
              {initialTotal} propiedad{initialTotal === 1 ? "" : "es"} en esta
              zona
            </h2>
            {list}
          </section>
        </div>
      ) : (
        list
      )}
    </div>
  );
}

