"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { GOOGLE_MAPS_AVAILABLE, useGoogleMaps, type GoogleMaps } from "@/modules/maps/hooks";
import { cn } from "@/lib/utils";

export type LocationResult = {
  lat: number;
  lng: number;
  address?: string;
  colonia?: string;
  city?: string;
  state?: string;
  zip_code?: string;
};

type Props = {
  initialLat?: number | null;
  initialLng?: number | null;
  onChange?: (loc: LocationResult) => void;
  className?: string;
};

const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };

/**
 * Draggable-pin map picker used to set a property's exact location.
 * Reverse geocodes the pin position (debounced) into address parts.
 */
export function PropertyLocationPicker({
  initialLat,
  initialLng,
  onChange,
  className,
}: Props): React.JSX.Element {
  const google = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<InstanceType<GoogleMaps["maps"]["Map"]> | null>(null);
  const markerRef = useRef<InstanceType<GoogleMaps["maps"]["Marker"]> | null>(null);
  const listenersRef = useRef<Array<{ remove: () => void }>>([]);
  const lastEmitRef = useRef<LocationResult | null>(null);
  const debounceRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!google || !mapRef.current) return;

    const center =
      typeof initialLat === "number" && typeof initialLng === "number"
        ? { lat: initialLat, lng: initialLng }
        : DEFAULT_CENTER;

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
    });
    const marker = new google.maps.Marker({
      map,
      position: center,
      draggable: true,
      title: "Arrastra para ubicar",
      animation: google.maps.Animation.DROP,
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    const emitCurrentPosition = (position: InstanceType<GoogleMaps["maps"]["LatLng"]>) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: position }, (results, status) => {
          const lat = position.lat();
          const lng = position.lng();
          let address: string | undefined;
          let colonia: string | undefined;
          let city: string | undefined;
          let state: string | undefined;
          let zip_code: string | undefined;

          if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
            const result = results[0];
            address = result.formatted_address;
            for (const component of result.address_components) {
              if (
                component.types.includes("sublocality_level_1") ||
                component.types.includes("neighborhood")
              ) {
                colonia = component.long_name;
              }
              if (
                component.types.includes("locality") ||
                component.types.includes("administrative_area_level_2")
              ) {
                city = component.long_name;
              }
              if (component.types.includes("administrative_area_level_1")) {
                state = component.long_name;
              }
              if (component.types.includes("postal_code")) {
                zip_code = component.long_name;
              }
            }
          }

          const result: LocationResult = { lat, lng, address, colonia, city, state, zip_code };
          lastEmitRef.current = result;
          onChangeRef.current?.(result);
        });
      }, 250);
    };

    const clickListener = google.maps.event.addListener<InstanceType<GoogleMaps["maps"]["Map"]>>(
      map,
      "click",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: any) => {
        const latLng = event?.latLng as InstanceType<GoogleMaps["maps"]["LatLng"]> | undefined;
        if (!latLng) return;
        marker.setPosition(latLng);
        emitCurrentPosition(latLng);
      },
    );

    const dragListener = google.maps.event.addListener(marker, "dragend", () => {
      const position = marker.getPosition();
      if (position) emitCurrentPosition(position);
    });

    listenersRef.current = [clickListener, dragListener];
    setReady(true);
    setError(null);

    return () => {
      listenersRef.current.forEach((listener) => listener.remove());
      listenersRef.current = [];
      marker.setMap(null);
      markerRef.current = null;
      mapInstanceRef.current = null;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      setReady(false);
    };
  }, [google, initialLat, initialLng]);

  if (!GOOGLE_MAPS_AVAILABLE) {
    return (
      <div
        className={cn(
          "flex h-72 w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <MapPin className="h-4 w-4 shrink-0" />
        <span>
          Configura la clave de Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) para ajustar la
          ubicación.
        </span>
      </div>
    );
  }

  if (!google) {
    return (
      <div
        className={cn(
          "flex h-72 w-full animate-pulse items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground",
          className,
        )}
      >
        Cargando mapa…
      </div>
    );
  }

  return (
    <div className={cn("relative h-72 w-full overflow-hidden rounded-lg border", className)}>
      <div ref={mapRef} className="absolute inset-0" aria-label="Selector de ubicación" />
      {ready && (
        <div className="absolute left-2 top-2 z-10 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
          Arrastra el pin o haz clic para ubicar
        </div>
      )}
      {error && (
        <div className="absolute inset-x-2 bottom-2 z-10 rounded-md bg-destructive/90 px-2 py-1 text-xs text-destructive-foreground shadow">
          {error}
        </div>
      )}
    </div>
  );
}
