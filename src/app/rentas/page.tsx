import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  getSearchableColonias,
  searchListingsPage,
  type SearchFilters,
} from "@/modules/search/queries";
import { RentFiltersForm } from "@/modules/search/components/rent-filters";
import { SearchResults } from "@/modules/maps/components/search-results";
import {
  parseBoundsString,
  parseCategoriesParam,
  searchParamsSchema,
  type MapBounds,
} from "@/modules/lib/schemas";
import { toQueryString } from "@/modules/search/query-string";

export const metadata: Metadata = { title: "Propiedades en renta" };

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RentasPage({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);

  const bounds: MapBounds | null = parsed.data?.bounds
    ? (parseBoundsString(parsed.data.bounds) ?? null)
    : null;

  const selectedCategories = parseCategoriesParam(parsed.data?.categories);

  const filters: SearchFilters = {
    query: parsed.data?.query,
    // Rentas always shows rental listings; users can't switch deal types here.
    type: "rent",
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    category: selectedCategories.length > 0 ? undefined : parsed.data?.category,
    minPrice: parsed.data?.minPrice,
    maxPrice: parsed.data?.maxPrice,
    colonia: parsed.data?.colonia,
    minBedrooms: parsed.data?.minBedrooms,
    bounds: bounds ?? undefined,
    sortBy: parsed.data?.sortBy,
    limit: 24,
  };

  const [pageResult, colonias] = await Promise.all([
    searchListingsPage(filters),
    getSearchableColonias("rent"),
  ]);

  const { items: listings, total } = pageResult;

  // Mirrors `filters` for the paginated /api/search + markers endpoints so
  // infinite scroll and the map stay in sync with the first server render.
  const filtersQueryString = toQueryString({
    type: "rent",
    categories:
      selectedCategories.length > 0 ? selectedCategories.join(",") : undefined,
    category: selectedCategories.length > 0 ? undefined : parsed.data?.category,
    minPrice: parsed.data?.minPrice,
    maxPrice: parsed.data?.maxPrice,
    colonia: parsed.data?.colonia,
    minBedrooms: parsed.data?.minBedrooms,
    sortBy: parsed.data?.sortBy,
    bounds: parsed.data?.bounds,
  });

  const mapSearch = parsed.data?.mapSearch === "true";

  // Presentation style lives in the URL. Legacy `mapSearch=true` still maps
  // to the full-map view; otherwise the Airbnb-style split is the default.
  const view: "list" | "map" | "split" =
    parsed.data?.view ?? (mapSearch ? "map" : "split");

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <PageHeader
          eyebrow="Rentar"
          icon={Building2}
          title="Propiedades en renta"
          description={`${total} propiedad${total === 1 ? "" : "es"} en renta${total > 0 ? " disponibles" : ""}`}
          className="mb-8"
        />

        <div className="mb-8">
          <RentFiltersForm colonias={colonias} />
        </div>

        {total === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No hay propiedades en renta que coincidan con tu búsqueda.
            </p>
          </div>
        ) : (
          <SearchResults
            key={filtersQueryString}
            initialItems={listings}
            initialTotal={total}
            filtersQueryString={filtersQueryString}
            view={view}
            initialBounds={bounds}
            card="search"
            basePath="/rentas"
            gridClassName="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
          />
        )}
      </main>
    </div>
  );
}
