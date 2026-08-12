"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useGoogleMaps, usePlacesAutocomplete, resolvePlace, useGmpxPlacePicker } from "@/modules/maps/hooks";
import { GOOGLE_MAPS_AVAILABLE } from "@/modules/maps/hooks";
import { PlacePickerField } from "@/modules/maps/components/place-picker-field";

export type AutocompleteResult = {
  formatted_address: string;
  city: string;
  state: string;
  colonia: string;
  zip_code: string;
  lat: number | null;
  lng: number | null;
};

/**
 * Address autocomplete field backed by Google Places.
 * Uses the modern gmpx-place-picker web component when the extended
 * component library is available; falls back to a legacy Places input.
 * Renders a plain input when the Maps API key is not configured.
 */
export function PlacesAutocomplete({
  value,
  onSelect,
  placeholder,
}: {
  value: string;
  onSelect: (result: AutocompleteResult, raw: string) => void;
  placeholder?: string;
}) {
  const google = useGoogleMaps();
  const gmpxReady = useGmpxPlacePicker();
  const suggestions = usePlacesAutocomplete(value);
  const [open, setOpen] = useState(false);

  if (!GOOGLE_MAPS_AVAILABLE || !google) {
    return (
      <Input
        value={value}
        onChange={(e) => onSelect({ formatted_address: e.target.value, city: "", state: "", colonia: "", zip_code: "", lat: null, lng: null }, e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  if (gmpxReady) {
    return (
      <PlacePickerField
        placeholder={placeholder}
        onSelect={onSelect}
      />
    );
  }

  const handlePick = async (placeId: string, raw: string) => {
    setOpen(false);
    const place = await resolvePlace(google, placeId);
    if (!place) {
      onSelect({ formatted_address: raw, city: "", state: "", colonia: "", zip_code: "", lat: null, lng: null }, raw);
      return;
    }
    const components = place.address_components ?? [];
    const find = (types: string[]) =>
      components.find((c) => c.types.some((t) => types.includes(t)))?.long_name ?? "";
    const result: AutocompleteResult = {
      formatted_address: place.formatted_address,
      city: find(["locality", "postal_town"]),
      state: find(["administrative_area_level_1"]),
      colonia: find(["sublocality_level_1", "neighborhood"]),
      zip_code: find(["postal_code"]),
      lat: place.geometry?.location.lat() ?? null,
      lng: place.geometry?.location.lng() ?? null,
    };
    onSelect(result, place.formatted_address);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={value}
          onChange={(e) => {
            onSelect({ formatted_address: e.target.value, city: "", state: "", colonia: "", zip_code: "", lat: null, lng: null }, e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handlePick(s.place_id, s.formatted_address);
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{s.formatted_address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
