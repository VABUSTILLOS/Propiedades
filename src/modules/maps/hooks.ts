"use client";

import { useEffect, useRef, useState } from "react";

/** The global `google` namespace as a type (from the ambient d.ts). */
export type GoogleMaps = typeof google;

/**
 * Loads the Google Maps JS API lazily (client-only).
 * Uses the 2026 "beta" channel with the modern Marker library
 * (`maps,marker`) so AdvancedMarkerElement + gmp-map web components work,
 * plus `places` for the Places autocomplete / POI features.
 * Returns null when no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured,
 * so the app degrades gracefully without the key.
 */
let promise: Promise<GoogleMaps | null> | null = null;

function loadMapsApi(): Promise<GoogleMaps | null> {
  if (promise) return promise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    promise = Promise.resolve(null);
    return promise;
  }

  promise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google ?? null));
      existing.addEventListener("error", () => resolve(null));
      return;
    }

    // Web components (gmp-map / gmp-advanced-marker) require the `callback`
    // param; console.debug is the no-op the official docs recommend.
    const callbackName = "__gmapsBootstrap";
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&v=beta&libraries=maps,marker,places&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    window.__gmapsBootstrap = () => {
      resolve(window.google ?? null);
    };
    script.addEventListener("error", () => resolve(null));
    document.head.appendChild(script);
  });

  return promise;
}

/** Client-only hook exposing the loaded `google` namespace (or null). */
export function useGoogleMaps(): GoogleMaps | null {
  const [g, setG] = useState<GoogleMaps | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMapsApi().then((loaded) => {
      if (!cancelled) setG(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return g;
}

export type PlaceResult = {
  place_id: string;
  formatted_address: string;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry?: {
    location: { lat(): number; lng(): number };
  };
};

/**
 * Debounced Places Autocomplete hook.
 * `query` is the raw input; the returned suggestions are for display.
 */
export function usePlacesAutocomplete(query: string): PlaceResult[] {
  const google = useGoogleMaps();
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const serviceRef = useRef<InstanceType<GoogleMaps["maps"]["places"]["AutocompleteService"]> | null>(
    null,
  );

  // Initialize the shared Places service when the API finishes loading.
  useEffect(() => {
    if (!google) return;
    if (!serviceRef.current) {
      serviceRef.current = new google.maps.places.AutocompleteService();
    }
  }, [google]);

  // Debounced predictions; only fires while the query is non-empty.
  useEffect(() => {
    if (!google || !query.trim()) return;
    const service = serviceRef.current;
    if (!service) return;

    const timer = window.setTimeout(() => {
      service.getPlacePredictions(
        { input: query.trim(), componentRestrictions: { country: "mx" } },
        (predictions) => {
          setSuggestions(
            (predictions ?? []).map((p) => ({
              place_id: p.place_id,
              formatted_address: p.description,
            })),
          );
        },
      );
    }, 250);

    return () => window.clearTimeout(timer);
  }, [google, query]);

  // Return stale suggestions only while a query is still being typed.
  return query.trim() ? suggestions : [];
}

/**
 * Resolves a place_id into a full PlaceResult (formatted address,
 * address components, and lat/lng) using the PlacesService.
 * Returns null when unavailable.
 */
export async function resolvePlace(
  google: GoogleMaps | null,
  placeId: string,
): Promise<PlaceResult | null> {
  if (!google || !placeId) return null;

  return new Promise((resolve) => {
    const service = new google.maps.places.PlacesService(
      document.createElement("div"),
    );
    service.getDetails(
      { placeId, fields: ["place_id", "formatted_address", "address_components", "geometry"] },
      (place) => {
        if (!place) {
          resolve(null);
          return;
        }
        resolve({
          place_id: place.place_id ?? "",
          formatted_address: place.formatted_address ?? "",
          address_components: place.address_components?.map((c) => ({
            long_name: c.long_name,
            short_name: c.short_name,
            types: c.types ?? [],
          })),
          geometry: place.geometry
            ? {
                location: {
                  lat: () => place.geometry!.location.lat(),
                  lng: () => place.geometry!.location.lng(),
                },
              }
            : undefined,
        });
      },
    );
  });
}

export const GOOGLE_MAPS_AVAILABLE = Boolean(
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
);

/** Map ID used by the 2026 Marker library (required for advanced markers). */
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "";

/** True when both the API key and a Map ID are configured. */
export const GOOGLE_MAPS_ADVANCED = Boolean(
  GOOGLE_MAPS_AVAILABLE && GOOGLE_MAPS_MAP_ID,
);
