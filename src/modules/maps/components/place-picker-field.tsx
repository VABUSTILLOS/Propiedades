"use client";

import { useEffect, useRef, useState } from "react";

import { useGmpxPlacePicker } from "@/modules/maps/hooks";
import { cn } from "@/lib/utils";

import type { AutocompleteResult } from "@/modules/maps/components/places-autocomplete";

type Props = {
  onSelect: (result: AutocompleteResult, raw: string) => void;
  placeholder?: string;
  className?: string;
};

function displayNameOf(
  displayName: string | { text: string } | undefined,
): string {
  if (!displayName) return "";
  return typeof displayName === "string" ? displayName : displayName.text;
}

function toLocation(
  location: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
): { lat: number; lng: number } | null {
  if (!location) return null;
  if (typeof location.lat === "function") {
    const latLng = location as google.maps.LatLng;
    return { lat: latLng.lat(), lng: latLng.lng() };
  }
  const literal = location as google.maps.LatLngLiteral;
  return { lat: literal.lat, lng: literal.lng };
}

function toResult(place: google.maps.Place): AutocompleteResult {
  const components = place.addressComponents ?? [];
  const find = (types: string[]) =>
    components.find((c) => c.types.some((t) => types.includes(t)))
      ?.longText ?? "";
  const location = toLocation(place.location);
  return {
    formatted_address: place.formattedAddress ?? displayNameOf(place.displayName),
    city: find(["locality", "postal_town"]),
    state: find(["administrative_area_level_1"]),
    colonia: find(["sublocality_level_1", "neighborhood"]),
    zip_code: find(["postal_code"]),
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
  };
}

/**
 * Address picker powered by the gmpx-place-picker web component from the
 * @googlemaps/extended-component-library. Emits the same AutocompleteResult
 * shape as the legacy PlacesAutocomplete so callers are agnostic.
 * Renders an empty container until the extended library registers.
 */
export function PlacePickerField({
  onSelect,
  placeholder,
  className,
}: Props): React.JSX.Element {
  const ready = useGmpxPlacePicker();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLGmpxPlacePickerElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!ready) return;
    const host = hostRef.current;
    if (!host || pickerRef.current) return;
    let cancelled = false;
    void window.customElements
      .whenDefined("gmpx-place-picker")
      .then(() => {
        if (cancelled || pickerRef.current) return;
        const picker = document.createElement("gmpx-place-picker");
        if (placeholder) picker.placeholder = placeholder;
        picker.addEventListener("gmpx-placechange", () => {
          const place = picker.value;
          if (!place) return;
          onSelectRef.current(toResult(place), place.formattedAddress ?? "");
        });
        host.appendChild(picker);
        pickerRef.current = picker;
        setMounted(true);
      })
      .catch(() => {
        /* library failed; keep empty container */
      });
    return () => {
      cancelled = true;
      if (pickerRef.current) {
        host.removeChild(pickerRef.current);
      }
      pickerRef.current = null;
      setMounted(false);
    };
  }, [ready, placeholder]);

  return (
    <div
      ref={hostRef}
      className={cn(
        "gmpx-place-picker-host [&>gmpx-place-picker]:w-full",
        className,
      )}
    >
      {ready && !mounted && (
        <div className="h-10 animate-pulse rounded-md bg-muted/40" />
      )}
    </div>
  );
}
