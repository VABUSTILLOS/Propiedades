"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarkerClusterer, type Cluster } from "@googlemaps/markerclusterer";
import { X } from "lucide-react";

import {
  GOOGLE_MAPS_AVAILABLE,
  useGoogleMaps,
  type GoogleMaps,
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
 * OverlayView subclass (created per map) that anchors a plain DOM container
 * above a pin. React content is rendered into it via `createPortal`, so the
 * popup keeps full Tailwind styling while tracking pan/zoom.
 */
function buildPopupOverlayClass(
  google: GoogleMaps,
  onAttach: (container: HTMLDivElement | null) => void,
) {
  return class extends google.maps.OverlayView {
    readonly container = document.createElement("div");
    private position: google.maps.LatLng | null = null;
    override onAdd() {
      this.container.style.position = "absolute";
      this.container.style.pointerEvents = "auto";
      this.getPanes()?.overlayMouseTarget.appendChild(this.container);
      onAttach(this.container);
    }
    override onRemove() {
      this.container.parentNode?.removeChild(this.container);
      onAttach(null);
    }
    setPinPosition(position: google.maps.LatLng | null) {
      this.position = position;
      this.draw();
    }
    override draw() {
      if (!this.position) return;
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.container.style.left = `${point.x}px`;
      this.container.style.top = `${point.y}px`;
      // Bottom-center of the popup sits exactly on the pin.
      this.container.style.transform = "translate(-50%, -100%)";
    }
  };
}

type PinPopupOverlay = InstanceType<
  ReturnType<typeof buildPopupOverlayClass>
>;

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
  const popupOverlayRef = useRef<PinPopupOverlay | null>(null);

  const [pinSelectedId, setPinSelectedId] = useState<string | null>(null);
  const [popupTarget, setPopupTarget] = useState<HTMLDivElement | null>(null);
  const [suggest, setSuggest] = useState<{
    bounds: MapBounds;
    count: number;
  } | null>(null);

  // The floating popup is driven by either a pin click (internal) or a
  // listing chosen from the list in split view (parent-controlled).
  const selectedId = selectionId ?? pinSelectedId;
  const selected = markers.find((m) => m.id === selectedId) ?? null;

  // Create the map once and listen for pan/zoom idle.
  useEffect(() => {
    if (!google || !containerRef.current || mapRef.current) return;

    const map = createMap(google, containerRef.current, {
      // Chihuahua city center as a sane default.
      center: { lat: 28.6353, lng: -106.0889 },
      zoom: 11,
    });
    mapRef.current = map;

    const PopupOverlay = buildPopupOverlayClass(google, setPopupTarget);
    popupOverlayRef.current = new PopupOverlay();

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
      popupOverlayRef.current?.setMap(null);
      popupOverlayRef.current = null;
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
      });
      handle.addListener("click", () => setPinSelectedId(marker.id));
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

  // Anchor the floating popup to the selected pin. The overlay lives in the
  // map's mouse-target pane so React can portal into it and the card tracks
  // pan/zoom automatically (OverlayView.draw repositions on every frame).
  useEffect(() => {
    const map = mapRef.current;
    const overlay = popupOverlayRef.current;
    if (!google || !map || !overlay) return;

    if (!selected) {
      overlay.setMap(null);
      return;
    }

    overlay.setPinPosition(new google.maps.LatLng(selected.lat, selected.lng));
    overlay.setMap(map);

    // Nudge the pin below center so the popup (drawn above the pin) fits.
    map.panTo({ lat: selected.lat, lng: selected.lng });
    map.panBy(0, -120);
  }, [google, selected]);

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
        <div className="absolute inset-x-0 top-3 z-10 flex justify-center">
          <button
            type="button"
            onClick={() => {
              onApplyBounds?.(suggest.bounds);
              setSuggest(null);
            }}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg transition-transform hover:scale-[1.03]"
          >
            Mostrar {suggest.count}{" "}
            {suggest.count === 1 ? "propiedad" : "propiedades"} en esta zona
          </button>
        </div>
      )}

      {popupTarget &&
        selected &&
        createPortal(
          <div
            className="relative pb-3"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <MapPropertyPopup
              marker={selected}
              from={from}
              onClose={() => setPinSelectedId(null)}
            />
            <div
              aria-hidden="true"
              className="absolute bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r bg-background"
            />
          </div>,
          popupTarget,
        )}
    </div>
  );
}
