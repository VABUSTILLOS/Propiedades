import type { ChatFilters } from "@/modules/chat/types";
import { toQueryString } from "@/modules/search/query-string";

const formatMXN = (n: number) => `$${n.toLocaleString("es-MX")} MXN`;

/** Human-readable chips describing the filters the bot understood from a query. */
export function describeFilters(filters: ChatFilters | undefined): string[] {
  if (!filters) return [];
  const chips: string[] = [];

  if (filters.type) chips.push(filters.type === "rent" ? "En renta" : "En venta");
  if (filters.city) chips.push(filters.city);
  if (filters.colonia) chips.push(`Col. ${filters.colonia}`);

  if (filters.minPrice != null && filters.maxPrice != null) {
    chips.push(`${formatMXN(filters.minPrice)} – ${formatMXN(filters.maxPrice)}`);
  } else if (filters.minPrice != null) {
    chips.push(`Desde ${formatMXN(filters.minPrice)}`);
  } else if (filters.maxPrice != null) {
    chips.push(`Hasta ${formatMXN(filters.maxPrice)}`);
  }

  if (filters.minM2 != null && filters.maxM2 != null) {
    chips.push(`${filters.minM2}–${filters.maxM2} m²`);
  } else if (filters.minM2 != null) {
    chips.push(`Desde ${filters.minM2} m²`);
  } else if (filters.maxM2 != null) {
    chips.push(`Hasta ${filters.maxM2} m²`);
  }

  if (filters.minBedrooms != null) chips.push(`Mín. ${filters.minBedrooms} rec.`);
  if (filters.isLand) chips.push("Terreno");
  if (filters.query) chips.push(`“${filters.query}”`);

  return chips;
}

/** URL for /search that reproduces the chat filters (terrenos go to the terreno tab). */
export function chatFiltersSearchUrl(filters: ChatFilters | undefined): string {
  if (!filters) return "/search";
  const qs = toQueryString({
    query: filters.query,
    type: filters.type,
    city: filters.city,
    colonia: filters.colonia,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minM2: filters.minM2,
    maxM2: filters.maxM2,
    minBedrooms: filters.minBedrooms,
    tab: filters.isLand ? "terreno" : undefined,
  });
  return qs ? `/search?${qs}` : "/search";
}
