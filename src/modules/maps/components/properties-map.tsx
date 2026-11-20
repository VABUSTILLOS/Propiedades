"use client";

import { useEffect, useRef, useState } from "react";
import { MarkerClusterer, type Cluster } from "@googlemaps/markerclusterer";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import {
  GOOGLE_MAPS_AVAILABLE,
  useGoogleMaps,
} from "@/modules/maps/hooks";
import {
  createMap,
  createMarker,
  type MapMarkerHandle,
} from "@/modules/maps/markers";
import { MapPropertyPopup } from "@/modules/maps/components/map-property-popup";
import type { PropertyMapMarker } from "@/modules/search/queries";
import type { MapBounds } from "@/modules/lib/schemas";
import { formatCompactPrice } from "@/modules/lib/real-estate";
import { cn } from "@/lib/utils";

/**
 * The pin popup is NOT positioned through Google's OverlayView projection:
 * `fromLatLngToDivPixel` proved unreliable in this layout (it returned
 * points hundreds of pixels away from where the marker actually renders,
 * leaving the card parked against the map's corner on mobile and desktop
 * alike). Instead the popup is rendered in a layer over the map and, while
 * open, a rAF loop positions it from the pin pill's own
 * `getBoundingClientRect()` — the exact spot the user sees — clamped
 * inside the map with an 8px margin.
 */

/** Min viewport delta (degrees) before a new "show in this area" suggestion. */
const EPSILON = 1e-4;

function inBounds(bounds: MapBounds, marker: PropertyMapMarker): boolean {
  return (
    marker.lat >= bounds.minLat &&
    marker.lat <= bounds.maxLat &&
    marker.lng >= bounds.minLng &&
    marker.lng <= bounds.maxLng
  );
}

/**
 * Nearest pin strictly to the left/right of `selected` (ties broken by
 * vertical proximity). Co-located pins (same lng) are excluded so a stack
 * of duplicates never navigates "sideways" into itself.
 */
function findDirectionalNeighbor(
  markers: PropertyMapMarker[],
  selected: PropertyMapMarker,
  direction: "left" | "right",
): PropertyMapMarker | null {
  const EPS_LNG = 1e-7;
  let best: PropertyMapMarker | null = null;
  let bestScore = Infinity;
  for (const m of markers) {
    if (m.id === selected.id) continue;
    const dlng = m.lng - selected.lng;
    if (direction === "right" ? dlng <= EPS_LNG : dlng >= -EPS_LNG) continue;
    const score = Math.abs(dlng) + Math.abs(m.lat - selected.lat) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/**
 * Airbnb-style interactive city map:
 * - Price pills on every matching listing (advanced markers, legacy fallback)
 * - Clustering with click-to-zoom-in
 * - Pan/zoom idle → "Mostrar N propiedades en esta zona" pill
 * - Click pin → floating popup card (carousel + specs) → property page
 *
 * The map is fully controlled: the parent owns which filters/bounds are
 * applied, and `initialBounds` (re)centers it on navigation.
 */
export function PropertiesMap({
  markers,
  initialBounds,
  activeBounds,
  onApplyBounds,
  onResetBounds,
  heightClass = "h-[70vh]",
  highlightedId = null,
  focusId = null,
  focusPosition = null,
  selectionId = null,
  onSelectPin,
  from,
}: {
  markers: PropertyMapMarker[];
  /** Center the map on these bounds when they appear (URL-driven navigation). */
  initialBounds?: MapBounds | null;
  /** Bounds currently applied to the list — shows the "Restablecer zona" pill. */
  activeBounds?: MapBounds | null;
  onApplyBounds?: (bounds: MapBounds) => void;
  onResetBounds?: () => void;
  heightClass?: string;
  /** Card hovered in the list — scales its price pill (Airbnb-style sync). */
  highlightedId?: string | null;
  /** Listing opened in the split detail pane — pans/zooms to its pin. */
  focusId?: string | null;
  /**
   * Coordinates of the listing opened in the split detail pane. Takes
   * precedence over `focusId`: works even when the pin is not (yet) in the
   * fetched marker set, and suppresses fit-bounds while active. Set
   * `approximate` when the position is a colonia/city centroid estimate for
   * an ungeocoded listing — the camera then stops at neighborhood zoom
   * instead of street zoom.
   */
  focusPosition?: { lat: number; lng: number; approximate?: boolean } | null;
  /** Listing selected from the list — shows the compact bottom card (like a pin click). */
  selectionId?: string | null;
  /** Notified when a pin gets selected (click or popup nav arrows) so the
   *  parent can sync its own state (e.g. the split detail pane). */
  onSelectPin?: (id: string) => void;
  /** Full URL of the current list/search view so the detail page can link back. */
  from?: string;
}) {
  const google = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const handlesRef = useRef<Map<string, MapMarkerHandle>>(new Map());
  const pillElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const markersRef = useRef<PropertyMapMarker[]>(markers);
  const lastEmittedRef = useRef<MapBounds | null>(null);
  const popupPosRef = useRef<HTMLDivElement | null>(null);

  const [pinSelectedId, setPinSelectedId] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<{
    bounds: MapBounds;
    count: number;
  } | null>(null);

  // Latest callback so marker click listeners never capture a stale parent.
  const onSelectPinRef = useRef(onSelectPin);
  useEffect(() => {
    onSelectPinRef.current = onSelectPin;
  }, [onSelectPin]);

  // The floating popup is driven by either a pin click (internal) or a
  // listing chosen from the list in split view (parent-controlled).
  const selectedId = selectionId ?? pinSelectedId;
  const selected = markers.find((m) => m.id === selectedId) ?? null;

  const selectPin = (id: string) => {
    setPinSelectedId(id);
    onSelectPinRef.current?.(id);
  };

  // Slideshow-style neighbors: nearest pin strictly left/right of the popup.
  const prevNeighbor = selected
    ? findDirectionalNeighbor(markers, selected, "left")
    : null;
  const nextNeighbor = selected
    ? findDirectionalNeighbor(markers, selected, "right")
    : null;

  // Create the map once and listen for pan/zoom idle.
  useEffect(() => {
    if (!google || !containerRef.current || mapRef.current) return;

    const map = createMap(google, containerRef.current, {
      // Chihuahua city center as a sane default.
      center: { lat: 28.6353, lng: -106.0889 },
      zoom: 11,
    });
    mapRef.current = map;

    // Clicking the map background dismisses the pin popup.
    google.maps.event.addListener(map, "click", () => setPinSelectedId(null));

    google.maps.event.addListener(map, "idle", () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const current: MapBounds = {
        minLat: sw.lat(),
        minLng: sw.lng(),
        maxLat: ne.lat(),
        maxLng: ne.lng(),
      };
      const last = lastEmittedRef.current;
      const delta = last
        ? Math.max(
            Math.abs(current.minLat - last.minLat),
            Math.abs(current.minLng - last.minLng),
            Math.abs(current.maxLat - last.maxLat),
            Math.abs(current.maxLng - last.maxLng),
          )
        : Infinity;
      if (delta < EPSILON) return;
      lastEmittedRef.current = current;
      const count = markersRef.current.filter((m) => inBounds(current, m)).length;
      setSuggest({ bounds: current, count });
    });

    return () => {
      mapRef.current = null;
    };
  }, [google]);

  // Fit to the URL bounds when they appear. Without a bounds filter the map
  // keeps its default Chihuahua city view: markers only get fitted when they
  // form a focused cluster (e.g. a filtered search in a single area). If pins
  // span the whole catalog — Chihuahua plus outlying cities like Juárez —
  // fitting them would zoom the map way out, losing the default city center.
  useEffect(() => {
    const map = mapRef.current;
    if (!google || !map) return;
    // While a listing is focused (split detail pane open) the camera belongs
    // to the focus effect — refitting here would race/override its pan.
    if (focusPosition) return;

    if (initialBounds) {
      map.fitBounds(
        new google.maps.LatLngBounds(
          { lat: initialBounds.minLat, lng: initialBounds.minLng },
          { lat: initialBounds.maxLat, lng: initialBounds.maxLng },
        ),
      );
      lastEmittedRef.current = { ...initialBounds };
      return;
    }

    if (markers.length > 0) {
      const b = new google.maps.LatLngBounds();
      markers.forEach((m) => b.extend({ lat: m.lat, lng: m.lng }));
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      const spread =
        Math.abs(ne.lat() - sw.lat()) + Math.abs(ne.lng() - sw.lng());
      // Chihuahua city alone spans ~0.4° total; the whole catalog ~4.5°.
      if (spread <= 1) {
        map.fitBounds(b);
        lastEmittedRef.current = null;
      }
    }
  }, [google, markers, initialBounds, focusPosition]);

  // (Re)build markers + clusterer whenever the pin set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!google || !map) return;

    markersRef.current = markers;

    clustererRef.current?.clearMarkers();
    handlesRef.current.forEach((handle) => handle.setMap(null));
    handlesRef.current.clear();
    pillElsRef.current.clear();
    setPinSelectedId(null);

    const handles = markers.map((marker) => {
      const pill = document.createElement("div");
      pill.textContent = formatCompactPrice(marker.price, marker.type);
      pill.style.cssText = [
        "background:#C4571D",
        "color:#fff",
        "border-radius:9999px",
        "padding:4px 10px",
        "font-size:12px",
        "font-weight:700",
        "white-space:nowrap",
        "cursor:pointer",
        "border:2px solid #fff",
        "box-shadow:0 2px 6px rgba(0,0,0,.25)",
        "font-family:inherit",
        "transition:transform .15s ease, box-shadow .15s ease",
      ].join(";");
      pillElsRef.current.set(marker.id, pill);

      const handle = createMarker(google, {
        map,
        position: { lat: marker.lat, lng: marker.lng },
        title: marker.title,
        content: pill,
        label: formatCompactPrice(marker.price, marker.type),
        clickable: true,
      });
      handle.addListener("click", () => selectPin(marker.id));
      handlesRef.current.set(marker.id, handle);
      return handle;
    });

    if (handles.length > 0) {
      clustererRef.current = new MarkerClusterer({
        markers: handles.map((h) => h.getMarker()),
        map,
        onClusterClick: (_event: google.maps.MapMouseEvent, cluster: Cluster) => {
          if (cluster.bounds) map.fitBounds(cluster.bounds);
        },
      });
    }

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      handles.forEach((handle) => handle.setMap(null));
    };
  }, [google, markers]);

  // Pan/zoom to a listing when it is opened in the split detail pane. The pill
  // is already scaled via `highlightedId`; here we just bring the pin on view.
  // `focusPosition` (the listing's own coordinates) takes precedence: it works
  // even when the pin is missing from the fetched marker set.
  useEffect(() => {
    const map = mapRef.current;
    if (!google || !map) return;
    let target = focusPosition;
    if (!target && focusId) {
      const marker = markers.find((m) => m.id === focusId);
      target = marker ? { lat: marker.lat, lng: marker.lng } : null;
    }
    // Rows that were never geocoded fall back to (0,0) — never fly the
    // camera there; just leave the map on its current view.
    if (!target || (target.lat === 0 && target.lng === 0)) return;
    map.panTo(target);
    const minZoom = focusPosition?.approximate ? 14 : 16;
    map.setZoom(Math.max(map.getZoom() ?? 11, minZoom));
  }, [google, markers, focusId, focusPosition]);

  // Bring the selected pin into view, nudged below center so the popup
  // (drawn above the pin) fits. Phones get a bigger nudge: the popup is
  // tall relative to a small viewport and its top was getting clipped.
  useEffect(() => {
    const map = mapRef.current;
    if (!google || !map || !selected) return;

    map.panTo({ lat: selected.lat, lng: selected.lng });
    map.panBy(0, window.innerWidth < 1024 ? -180 : -120);
  }, [google, selected]);

  // Track the popup to its pin while it is open. Every frame, read the
  // pill's real on-screen rect and place the popup's bottom-center on it,
  // clamped inside the map (8px margin). The pill rect is ground truth —
  // it is exactly where the user sees the pin — so the card stays glued
  // to the pin through pan/zoom animations and layout shifts alike. If
  // the pill is not in the DOM (legacy marker, or the pin is clustered),
  // fall back to centering the card at the top of the map: the pan above
  // already brought the pin to the middle of the view.
  useEffect(() => {
    if (!selected) return;
    let raf = 0;
    const tick = () => {
      const el = popupPosRef.current;
      const mapEl = containerRef.current;
      if (el && mapEl) {
        const mapRect = mapEl.getBoundingClientRect();
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (w > 0 && h > 0 && mapRect.width > 0) {
          const pill = pillElsRef.current.get(selected.id);
          const pillRect = pill?.getBoundingClientRect();
          let x: number;
          let y: number;
          if (pillRect && pillRect.width > 0) {
            const anchorX =
              pillRect.left + pillRect.width / 2 - mapRect.left;
            const anchorY = pillRect.bottom - mapRect.top;
            x = anchorX - w / 2;
            y = anchorY - h;
          } else {
            x = (mapRect.width - w) / 2;
            y = 8;
          }
          if (mapRect.width > w) {
            x = Math.max(8, Math.min(mapRect.width - w - 8, x));
          }
          y = Math.max(8, y);
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.visibility = "visible";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  // Escape dismisses a pin-click popup (split-view selection is closed by
  // the parent that owns `selectionId`).
  useEffect(() => {
    if (!pinSelectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pinSelectedId]);

  // Highlight the selected/hovered pill via direct DOM (avoids rebuilding markers).
  useEffect(() => {
    pillElsRef.current.forEach((el, id) => {
      if (id === selectedId || id === highlightedId) {
        el.style.transform = "scale(1.15)";
        el.style.zIndex = "2";
        el.style.boxShadow = "0 0 0 3px #fff, 0 6px 16px rgba(0,0,0,.3)";
      } else {
        el.style.transform = "";
        el.style.zIndex = "";
        el.style.boxShadow = "0 2px 6px rgba(0,0,0,.25)";
      }
    });
  }, [selectedId, highlightedId]);

  if (!GOOGLE_MAPS_AVAILABLE) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground",
          heightClass,
        )}
      >
        La vista de mapa requiere una clave NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border", heightClass)}>
      <div
        ref={containerRef}
        className="size-full"
        aria-label="Mapa de propiedades"
      />

      {activeBounds && (
        <button
          type="button"
          onClick={onResetBounds}
          className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-background"
        >
          <X className="size-3.5" aria-hidden="true" />
          Restablecer zona
        </button>
      )}

      {suggest && suggest.count > 0 && !selected && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <button
            type="button"
            onClick={() => {
              onApplyBounds?.(suggest.bounds);
              setSuggest(null);
            }}
            className="pointer-events-auto rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg transition-transform hover:scale-[1.03]"
          >
            Mostrar {suggest.count}{" "}
            {suggest.count === 1 ? "propiedad" : "propiedades"} en esta zona
          </button>
        </div>
      )}

      {selected && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          <div
            ref={popupPosRef}
            className="pointer-events-auto absolute"
            style={{ left: 0, top: 0, visibility: "hidden" }}
          >
          <div
            className="relative pb-3"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <MapPropertyPopup
              marker={selected}
              from={from}
              onClose={() => setPinSelectedId(null)}
            />
            <button
              type="button"
              aria-label="Propiedad anterior a la izquierda"
              disabled={!prevNeighbor}
              onClick={(e) => {
                e.stopPropagation();
                if (prevNeighbor) selectPin(prevNeighbor.id);
              }}
              className="absolute -left-14 top-1/2 -translate-y-1/2 rounded-full bg-[#C4571D] p-2.5 text-white shadow-lg transition-all hover:scale-105 hover:bg-[#A83810] disabled:pointer-events-none disabled:opacity-0 max-lg:-left-2 max-lg:p-2"
            >
              <ChevronLeft className="size-6 max-lg:size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Siguiente propiedad a la derecha"
              disabled={!nextNeighbor}
              onClick={(e) => {
                e.stopPropagation();
                if (nextNeighbor) selectPin(nextNeighbor.id);
              }}
              className="absolute -right-14 top-1/2 -translate-y-1/2 rounded-full bg-[#C4571D] p-2.5 text-white shadow-lg transition-all hover:scale-105 hover:bg-[#A83810] disabled:pointer-events-none disabled:opacity-0 max-lg:-right-2 max-lg:p-2"
            >
              <ChevronRight className="size-6 max-lg:size-5" aria-hidden="true" />
            </button>
            <div
              aria-hidden="true"
              className="absolute bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r bg-background"
            />
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
