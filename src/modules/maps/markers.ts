"use client";

import {
  GOOGLE_MAPS_ADVANCED,
  GOOGLE_MAPS_MAP_ID,
  type GoogleMaps,
} from "@/modules/maps/hooks";

export type MapPosition = google.maps.LatLng | google.maps.LatLngLiteral;

export type MapMarkerHandle = {
  setPosition(position: MapPosition): void;
  getPosition(): MapPosition | null;
  setMap(map: google.maps.Map | null): void;
  addListener(
    eventName: string,
    handler: (event?: { stop?: () => void }) => void,
  ): { remove: () => void };
  /** The raw marker instance, for tools that need it (e.g. MarkerClusterer). */
  getMarker(): google.maps.Marker | google.maps.marker.AdvancedMarkerElement;
};

type MarkerOptions = {
  map: google.maps.Map;
  position: MapPosition;
  title?: string;
  draggable?: boolean;
  /** Pin background color (advanced markers only). */
  color?: string;
  /** Icon URL fallback used when advanced markers are unavailable. */
  iconUrl?: string;
  /** Custom marker DOM (advanced markers only) — e.g. price pills. */
  content?: HTMLElement;
  /** Text label fallback used when advanced markers are unavailable. */
  label?: string;
};

/**
 * Creates a `google.maps.Map` honoring the configured Map ID (required for
 * advanced markers). Without a Map ID it returns a plain legacy map.
 */
export function createMap(
  google: GoogleMaps,
  el: HTMLElement,
  opts: { center: MapPosition; zoom: number },
): google.maps.Map {
  return new google.maps.Map(el, {
    center: opts.center,
    zoom: opts.zoom,
    ...(GOOGLE_MAPS_MAP_ID ? { mapId: GOOGLE_MAPS_MAP_ID } : {}),
  });
}

/** Normalizes any position into a `LatLng` instance (needs `.lat()`/`.lng()`). */
function toLatLng(google: GoogleMaps, pos: MapPosition): google.maps.LatLng {
  if (pos instanceof google.maps.LatLng) return pos;
  return new google.maps.LatLng(pos.lat, pos.lng);
}

/**
 * Creates a marker using the 2026 AdvancedMarkerElement API when a Map ID is
 * configured, falling back to the legacy `google.maps.Marker` otherwise.
 * Both handles expose the same minimal API so callers don't branch.
 */
export function createMarker(
  google: GoogleMaps,
  options: MarkerOptions,
): MapMarkerHandle {
  const { map, position, title, draggable, color, iconUrl, content, label } =
    options;

  if (
    GOOGLE_MAPS_ADVANCED &&
    typeof google.maps.marker?.AdvancedMarkerElement === "function"
  ) {
    let pinContent: HTMLElement | string | undefined;
    if (content) {
      pinContent = content;
    } else if (color) {
      const pin = new google.maps.marker.PinElement({
        background: color,
        glyphColor: "#ffffff",
      });
      pinContent = pin.element;
    }
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      title,
      draggable,
      content: pinContent,
    });
    return {
      setPosition: (pos) => {
        marker.position = pos;
      },
      getPosition: () => marker.position,
      setMap: (m) => {
        marker.map = m;
      },
      addListener: (eventName, handler) => {
        marker.addEventListener(eventName, handler);
        return {
          remove: () => marker.removeEventListener(eventName, handler),
        };
      },
      getMarker: () => marker,
    };
  }

  const marker = new google.maps.Marker({
    map,
    position,
    title,
    draggable,
    ...(iconUrl ? { icon: { url: iconUrl } } : {}),
    ...(label ? { label: { text: label, color: "#ffffff", fontWeight: "700" as const, fontSize: "12px" } } : {}),
  });
  return {
    setPosition: (pos) => {
      marker.setPosition(pos);
    },
    getPosition: () => marker.getPosition(),
    setMap: (m) => {
      marker.setMap(m);
    },
    addListener: (eventName, handler) =>
      google.maps.event.addListener(marker, eventName, handler),
    getMarker: () => marker,
  };
}

export { toLatLng };
