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

    class Map {
      constructor(el: HTMLElement, opts?: Record<string, unknown>);
    }

    class Marker {
      constructor(opts?: {
        map?: Map;
        position?: LatLngLiteral;
        title?: string;
      });
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
  }
}
