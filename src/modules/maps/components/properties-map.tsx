"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MarkerClusterer, type Cluster } from "@googlemaps/markerclusterer";
import { X } from "lucide-react";

import { GOOGLE_MAPS_AVAILABLE, useGoogleMaps } from "@/modules/maps/hooks";
import {
  createMap,
  createMarker,
  type MapMarkerHandle,
} from "@/modules/maps/markers";
import type { PropertyMapMarker } from "@/modules/search/queries";
import type { MapBounds } from "@/modules/lib/schemas";
import { cn } from "@/lib/utils";

/** Min viewport delta (degrees) before a new "show in this area" suggestion. */
const EPSILON = 1e-4;

const compactPrice = new Intl.NumberFormat("es-MX", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatPrice(marker: PropertyMapMarker): string {
  const amount = `$${compactPrice.format(marker.price)}`;
  return marker.type === "rent" ? `${amount}/mes` : amount;
}

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
 * - Click pin → bottom card → property page
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
}: {
  markers: PropertyMapMarker[];
  /** Center the map on these bounds when they appear (URL-driven navigation). */
  initialBounds?: MapBounds | null;
  /** Bounds currently applied to the list — shows the "Restablecer zona" pill. */
  activeBounds?: MapBounds | null;
  onApplyBounds?: (bounds: MapBounds) => void;
  onResetBounds?: () => void;
  heightClass?: string;
}) {
  const google = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const handlesRef = useRef<Map<string, MapMarkerHandle>>(new Map());
  const pillElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const markersRef = useRef<PropertyMapMarker[]>(markers);
  const lastEmittedRef = useRef<MapBounds | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<{
    bounds: MapBounds;
    count: number;
  } | null>(null);

  markersRef.current = markers;

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

  // Fit to the URL bounds (or marker bounds) when they arrive.
  useEffect(() => {
    const map = mapRef.current;
    if (!google || !map) return;

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
      map.fitBounds(b);
      lastEmittedRef.current = null;
    }
  }, [google, markers, initialBounds]);

  // (Re)build markers + clusterer whenever the pin set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!google || !map) return;

    clustererRef.current?.clearMarkers();
    handlesRef.current.forEach((handle) => handle.setMap(null));
    handlesRef.current.clear();
    pillElsRef.current.clear();
    setSelectedId(null);

    const handles = markers.map((marker) => {
      const pill = document.createElement("div");
      pill.textContent = formatPrice(marker);
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
        label: formatPrice(marker),
      });
      handle.addListener("click", () => setSelectedId(marker.id));
      handlesRef.current.set(marker.id, handle);
      return handle;
    });

    if (handles.length > 0) {
      clustererRef.current = new MarkerClusterer({
        markers: handles.map((h) => h.getMarker()),
        map,
        onClusterClick: (_event: google.maps.MapMouseEvent, cluster: Cluster) => {
          map.fitBounds(cluster.getBounds());
        },
      });
    }

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      handles.forEach((handle) => handle.setMap(null));
      handlesRef.current.clear();
      pillElsRef.current.clear();
    };
  }, [google, markers]);

  // Highlight the selected pill via direct DOM (avoids rebuilding markers).
  useEffect(() => {
    pillElsRef.current.forEach((el, id) => {
      if (id === selectedId) {
        el.style.transform = "scale(1.15)";
        el.style.zIndex = "2";
        el.style.boxShadow = "0 0 0 3px #fff, 0 6px 16px rgba(0,0,0,.3)";
      } else {
        el.style.transform = "";
        el.style.zIndex = "";
        el.style.boxShadow = "0 2px 6px rgba(0,0,0,.25)";
      }
    });
  }, [selectedId]);

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

      {suggest && suggest.count > 0 && (
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

      {selected && (
        <div className="absolute inset-x-3 bottom-3 z-10">
          <div className="flex items-center gap-3 rounded-2xl bg-background/95 p-3 shadow-lg backdrop-blur">
            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
              {selected.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.images[0]}
                  alt={selected.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                  Sin foto
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-snug">{selected.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {[selected.colonia, selected.city].filter(Boolean).join(", ")}
              </p>
              <p className="text-sm font-bold">
                ${selected.price.toLocaleString()}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {selected.currency} ·{" "}
                  {selected.type === "rent" ? "renta" : "venta"}
                </span>
              </p>
            </div>
            <Link
              href={`/property/${selected.slug}`}
              className="shrink-0 rounded-full bg-[#C4571D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D67E3C]"
            >
              Ver propiedad
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
