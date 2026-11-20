"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronUp, Map as MapIcon } from "lucide-react";

import { cn } from "@/lib/utils";

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
  canModerate = false,
  canEdit = false,
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
  /** Master user (admin): enables multi-select moderation on the list. */
  canModerate?: boolean;
  /** Master user (admin) with editor mode on: adds "Editar" pills on cards. */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [markers, setMarkers] = useState<PropertyMapMarker[] | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ListingWithHot | null>(null);

  // The split-view detail pane is not a navigation, so without a history
  // entry of its own the browser/device Back button would skip the results
  // list entirely and land on whatever came before (often the homepage).
  // Opening the pane pushes a same-URL history entry; Back (popstate) then
  // just closes the pane and returns to the list with filters, sort and
  // scroll position untouched. The pane's own "Volver a resultados" button
  // replays that same Back step so both paths stay in sync.
  const selectedRef = useRef<ListingWithHot | null>(null);
  const panelHistoryRef = useRef(false);

  const openPanel = (item: ListingWithHot) => {
    if (!selectedRef.current) {
      window.history.pushState({ propertyPanel: item.id }, "");
      panelHistoryRef.current = true;
    }
    selectedRef.current = item;
    setSelectedItem(item);
  };

  const closePanel = () => {
    if (panelHistoryRef.current) {
      // The popstate handler below clears the selection.
      window.history.back();
    } else {
      selectedRef.current = null;
      setSelectedItem(null);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      if (panelHistoryRef.current) {
        panelHistoryRef.current = false;
        selectedRef.current = null;
        setSelectedItem(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // --- Mobile split view: draggable bottom sheet over a full map -------
  // On phones there is no room for side-by-side columns, so split view
  // follows the established map-app pattern (Zillow / Google Maps): the
  // map fills the stage and the results live in a bottom sheet with
  // three snap points — peek (handle + count), half (map + list share
  // the screen), full (list/detail take over). Dragging the sheet's
  // header moves between snaps; opening a property swaps the sheet
  // content to the detail pane at full height, so map, list and detail
  // are all reachable without a page navigation. Desktop (lg+) keeps
  // the classic two-column split and none of this applies.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageH, setStageH] = useState(0);
  const [sheetSnap, setSheetSnap] = useState(1);
  const [sheetDragH, setSheetDragH] = useState<number | null>(null);
  const sheetDragRef = useRef<{ startY: number; startH: number } | null>(
    null,
  );
  const sheetDragHRef = useRef<number | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageH(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const SHEET_PEEK_H = 74;
  const stagePx = stageH || 560;
  const snapHeights = [
    SHEET_PEEK_H,
    Math.round(stagePx * 0.55),
    Math.round(stagePx * 0.96),
  ];
  const sheetH = selectedItem
    ? (snapHeights[2] ?? stagePx)
    : (sheetDragH ?? snapHeights[sheetSnap] ?? Math.round(stagePx * 0.55));
  const sheetContentHidden =
    !selectedItem && sheetDragH == null && sheetSnap === 0;

  const onSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (selectedItem) return;
    sheetDragRef.current = { startY: e.clientY, startH: sheetH };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    if (!drag) return;
    const stage = stageRef.current?.clientHeight || 560;
    const next = Math.max(
      56,
      Math.min(stage * 0.98, drag.startH + drag.startY - e.clientY),
    );
    sheetDragHRef.current = next;
    setSheetDragH(next);
  };
  const onSheetPointerUp = () => {
    if (!sheetDragRef.current) return;
    sheetDragRef.current = null;
    const dragged = sheetDragHRef.current;
    sheetDragHRef.current = null;
    setSheetDragH(null);
    if (dragged == null) return;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    snapHeights.forEach((h, i) => {
      const dist = Math.abs(h - dragged);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setSheetSnap(best);
  };

  // Full current URL (path + filters) so the property detail page can send
  // users back to the exact listados/search view they came from.
  const currentQuery = searchParams.toString();
  const fromUrl = currentQuery ? `${basePath}?${currentQuery}` : basePath;

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
      from={fromUrl}
      gridClassName={
        split
          ? "grid gap-x-4 gap-y-6 sm:grid-cols-2"
          : gridClassName
      }
      emptyState={emptyState}
      onCardHover={setHoveredId}
      onCardSelect={split ? openPanel : undefined}
      canModerate={canModerate}
      canEdit={canEdit}
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
      onSelectPin={(id) => {
        // Split view: navigating with the popup arrows (or clicking a pin)
        // opens that listing in the detail pane when it's in the list;
        // otherwise the pane clears so the clicked pin owns the popup.
        const item = initialItems.find((l) => l.id === id);
        if (item) openPanel(item);
        else if (selectedRef.current) closePanel();
      }}
      heightClass={heightClass}
      from={fromUrl}
    />
  );

  return (
    <div className="space-y-6">
      {/* In mobile split view the stage below becomes a fixed,
          full-viewport layer that would cover this row, so the toggle
          moves inside the stage there (rendered in the split branch). */}
      <div
        className={cn(
          "flex justify-end",
          view === "split" && "max-lg:hidden",
        )}
      >
        <MapViewToggle
          view={view}
          onChange={(next) => updateParam({ view: next })}
          count={initialTotal}
        />
      </div>

      {view === "split" ? (
        <div
          ref={stageRef}
          className="relative max-lg:fixed max-lg:inset-x-0 max-lg:top-16 max-lg:bottom-0 max-lg:z-30 lg:grid lg:grid-cols-2 lg:gap-6"
        >
          {/* The view toggle lives in the sheet header on mobile (the
              compact icon-only variant below); the in-flow toggle row is
              hidden in mobile split because the fixed stage covers it. */}
          {/* Map: fills the whole stage behind the sheet on mobile;
              sticky right column on desktop. */}
          <div className="absolute inset-0 min-w-0 lg:static lg:order-2 lg:sticky lg:top-6 lg:self-start">
            {map("h-full lg:h-[calc(100vh-11rem)]")}
          </div>

          {/* Results: draggable bottom sheet on mobile (see the sheet
              state above), classic left column on desktop. */}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-20 flex h-[var(--sheet-h)] min-w-0 flex-col overflow-hidden rounded-t-3xl border-t bg-background shadow-[0_-10px_36px_rgba(0,0,0,0.22)] lg:static lg:order-1 lg:block lg:h-auto lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none",
              sheetDragH == null &&
                "transition-[height] duration-300 ease-out",
            )}
            style={{ "--sheet-h": `${sheetH}px` } as React.CSSProperties}
          >
            {/* Sheet drag header (mobile only): handle + result count.
                Dragging it snaps the sheet between peek / half / full;
                the chevron toggles half ⇄ full with a tap. */}
            <div
              className="flex shrink-0 touch-none flex-col items-center gap-1 px-4 pt-2.5 pb-2 select-none lg:hidden"
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={onSheetPointerUp}
              onPointerCancel={onSheetPointerUp}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-10 rounded-full bg-muted-foreground/30"
              />
              {!selectedItem && (
                <div className="flex w-full items-center justify-between gap-2">
                  <p className="text-sm font-semibold whitespace-nowrap">
                    {initialTotal} propiedad{initialTotal === 1 ? "" : "es"}
                  </p>
                  <div className="flex items-center gap-1">
                    <MapViewToggle
                      view={view}
                      onChange={(next) => updateParam({ view: next })}
                      count={initialTotal}
                      compact
                    />
                    <button
                      type="button"
                      aria-label={
                        sheetSnap === 2 ? "Ver más mapa" : "Ver más resultados"
                      }
                      onClick={() => setSheetSnap(sheetSnap === 2 ? 1 : 2)}
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronUp
                        className={cn(
                          "size-5 transition-transform duration-300",
                          sheetSnap === 2 && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-1 lg:overflow-visible lg:px-0 lg:pt-0",
                sheetContentHidden && "hidden lg:block",
              )}
            >
              {/* Keep the list mounted so infinite-scroll state survives;
                  swap it for the compact detail pane while a card is
                  selected. On mobile the pane fills the sheet (which
                  jumps to full height); on desktop it keeps its capped
                  column height. */}
              <div className={selectedItem ? "hidden" : undefined}>
                {list(true)}
              </div>
              {selectedItem && (
                <SplitDetailPanel
                  key={selectedItem.id}
                  listing={selectedItem}
                  onClose={closePanel}
                  from={fromUrl}
                  className="min-h-full rounded-none border-0 lg:min-h-0 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:rounded-2xl lg:border"
                />
              )}
            </div>
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

