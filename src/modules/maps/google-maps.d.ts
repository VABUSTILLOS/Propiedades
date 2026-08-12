/**
 * Minimal ambient types for the Google Maps JavaScript API loaded lazily.
 * Only the subset used by the maps module is declared.
 */
export {};

declare global {
  namespace google.maps {
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLng {
      constructor(lat: number, lng: number, noWrap?: boolean);
      lat(): number;
      lng(): number;
      toJSON(): LatLngLiteral;
    }

    class LatLngBounds {
      constructor(
        sw?: LatLng | LatLngLiteral | null,
        ne?: LatLng | LatLngLiteral | null,
      );
      extend(point: LatLng | LatLngLiteral): LatLngBounds;
      getCenter(): LatLng;
      getNorthEast(): LatLng;
      getSouthWest(): LatLng;
    }

    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      mapTypeId?: string;
      disableDefaultUI?: boolean;
      gestureHandling?: string;
      /** Required for AdvancedMarkerElement (2026 Marker library). */
      mapId?: string;
    }

    class Map {
      constructor(el: HTMLElement, opts?: MapOptions);
      setCenter(center: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      fitBounds(bounds: LatLngBounds): void;
      getBounds(): LatLngBounds | null;
    }

    class Size {
      constructor(width: number, height: number);
      width: number;
      height: number;
    }

    interface MarkerIcon {
      url: string;
      scaledSize?: Size;
    }

    interface MarkerOptions {
      map?: Map;
      position?: LatLng | LatLngLiteral;
      title?: string;
      draggable?: boolean;
      animation?: number;
      icon?: string | MarkerIcon;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setPosition(position: LatLng | LatLngLiteral): void;
      getPosition(): LatLng | null;
      setMap(map: Map | null): void;
    }

    interface MapMouseEvent {
      latLng: LatLng;
    }

    interface AddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }

    const event: {
      addListener: <TEvent = MapMouseEvent>(
        instance: object,
        eventName: string,
        handler: (event: TEvent) => void,
      ) => { remove: () => void };
    };

    enum Animation {
      DROP = 1,
      BOUNCE = 2,
    }

    enum GeocoderStatus {
      OK = "OK",
      ZERO_RESULTS = "ZERO_RESULTS",
      OVER_QUERY_LIMIT = "OVER_QUERY_LIMIT",
      REQUEST_DENIED = "REQUEST_DENIED",
      ERROR = "ERROR",
    }

    interface GeocoderRequest {
      address?: string;
      location?: LatLng | LatLngLiteral;
      bounds?: LatLngBounds;
      componentRestrictions?: { country?: string };
    }

    interface GeocoderResult {
      formatted_address: string;
      address_components: AddressComponent[];
      geometry: { location: LatLng };
    }

    class Geocoder {
      geocode(
        request: GeocoderRequest,
        callback: (
          results: GeocoderResult[] | null,
          status: GeocoderStatus,
        ) => void,
      ): void;
    }

    class InfoWindow {
      constructor(opts?: { content?: string });
      setContent(content: string): void;
      open(map?: Map, anchor?: Marker | null): void;
      close(): void;
    }

    class Place {
      name?: string;
      displayName?: string | { text: string };
      formattedAddress?: string;
      location?: LatLng | LatLngLiteral | null;
      viewport?: LatLngBounds | null;
      types?: string[];
      addressComponents?: Array<{
        longText?: string;
        shortText?: string;
        types: string[];
      }>;
    }
  }

  /** Web components from the Maps JS beta (`maps,marker`) and extended lib. */
  interface HTMLGmpMapElement extends HTMLElement {
    innerMap?: google.maps.Map | null;
    center?: google.maps.LatLngLiteral | string;
    zoom?: number | string;
    "map-id"?: string;
  }

  interface HTMLGmpAdvancedMarkerElement extends HTMLElement {
    position?: google.maps.LatLng | google.maps.LatLngLiteral | null;
    map?: google.maps.Map | null;
  }

  interface HTMLGmpxApiLoaderElement extends HTMLElement {
    key?: string;
    "solution-channel"?: string;
  }

  interface HTMLGmpxPlacePickerElement extends HTMLElement {
    value?: google.maps.Place | null;
    placeholder?: string;
  }

  interface HTMLElementTagNameMap {
    "gmp-map": HTMLGmpMapElement;
    "gmp-advanced-marker": HTMLGmpAdvancedMarkerElement;
    "gmpx-api-loader": HTMLGmpxApiLoaderElement;
    "gmpx-place-picker": HTMLGmpxPlacePickerElement;
  }

  namespace google.maps.marker {
    interface AdvancedMarkerElementOptions {
      map?: google.maps.Map;
      position?: google.maps.LatLng | google.maps.LatLngLiteral;
      title?: string;
      draggable?: boolean;
      content?: HTMLElement | string;
      zIndex?: number;
    }

    class AdvancedMarkerElement {
      constructor(options?: AdvancedMarkerElementOptions);
      map: google.maps.Map | null;
      position: google.maps.LatLng | google.maps.LatLngLiteral | null;
      title?: string;
      draggable?: boolean;
      addEventListener(type: string, listener: (event: { stop?: () => void }) => void): void;
      removeEventListener(type: string, listener: (event: { stop?: () => void }) => void): void;
    }

    interface PinElementOptions {
      background?: string;
      borderColor?: string;
      glyphColor?: string;
      scale?: number;
    }

    class PinElement {
      constructor(options?: PinElementOptions);
      element: HTMLElement;
    }
  }

  namespace google.maps.places {
    type Prediction = {
      place_id: string;
      description: string;
    };

    class AutocompleteService {
      getPlacePredictions(
        request: {
          input: string;
          componentRestrictions?: { country: string };
        },
        callback: (predictions: Prediction[] | null, status: unknown) => void,
      ): void;
    }

    class PlacesService {
      constructor(attrNode: HTMLElement);
      getDetails(
        request: { placeId: string; fields?: string[] },
        callback: (place: Place | null, status: unknown) => void,
      ): void;
      nearbySearch(
        request: {
          location: google.maps.LatLng | google.maps.LatLngLiteral;
          radius?: number;
          type?: string;
          keyword?: string;
        },
        callback: (results: PlaceResult[] | null, status: unknown) => void,
      ): void;
    }

    interface PlaceResult {
      place_id?: string;
      formatted_address?: string;
      name?: string;
      vicinity?: string;
      types?: string[];
      geometry?: { location: google.maps.LatLng };
    }

    interface AddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }

    interface Place {
      place_id?: string;
      formatted_address?: string;
      address_components?: AddressComponent[];
      geometry?: {
        location: { lat(): number; lng(): number };
      };
    }
  }

  interface Window {
    google?: typeof google;
    /** No-op bootstrap callback required by the Maps JS beta loader. */
    __gmapsBootstrap?: () => void;
  }
}
