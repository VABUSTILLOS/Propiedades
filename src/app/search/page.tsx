import type { Metadata } from "next";
import { Home } from "lucide-react";

import {
  enrichWithHot,
  getSearchableCities,
  searchListingsPage,
  type SearchFilters,
} from "@/modules/search/queries";
import { countActiveTab } from "@/modules/search/tab-counts";
import { searchSemantic } from "@/modules/ai/embeddings";
import { ComprarCintillo } from "@/modules/search/components/comprar-cintillo";
import { SearchFiltersForm } from "@/modules/search/components/search-filters";
import { SearchResults } from "@/modules/maps/components/search-results";
import {
  parseBoundsString,
  parseCategoriesParam,
  searchParamsSchema,
  type InvestorTab,
  type MapBounds,
} from "@/modules/lib/schemas";
import { tabToFilters } from "@/modules/search/investor-tabs";
import { toQueryString } from "@/modules/search/query-string";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { getCurrentUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Comprar" };

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);

  const bounds: MapBounds | null = parsed.data?.bounds
    ? (parseBoundsString(parsed.data.bounds) ?? null)
    : null;

  const user = await getCurrentUser();
  const canModerate = user?.role === "admin";

  // Multi-select property types (`categories` CSV). When present it wins over
  // the legacy single `category` param so both are never applied at once.
  const selectedCategories = parseCategoriesParam(parsed.data?.categories);

  // Opportunity tab from the cintillo (todos|remate|flipping|traspaso|comercial|terreno).
  const activeTab: InvestorTab = parsed.data?.tab ?? "todos";

  // Shared refinements (query, price, m², city) apply to every tab so
  // switching tabs keeps context; the cintillo counts react to them too.
  const baseFilters: Omit<SearchFilters, "limit" | "sortBy"> = {
    query: parsed.data?.query,
    type: parsed.data?.type,
    minPrice: parsed.data?.minPrice,
    maxPrice: parsed.data?.maxPrice,
    minBedrooms: parsed.data?.minBedrooms,
    city: parsed.data?.city,
    colonia: parsed.data?.colonia,
    minM2: parsed.data?.minM2,
    maxM2: parsed.data?.maxM2,
    bounds: bounds ?? undefined,
  };

  // Each tab maps to an explicit deal_type (remates/flipping/traspasos) and
  // property-type categories. "Comprar" no longer defaults to venta_directa:
  // the merged page is the single portal, so "Todos" shows every opportunity.
  const tabFiltersMap = tabToFilters(baseFilters, selectedCategories);
  const activeTabFilter = tabFiltersMap[activeTab];
  const hasTabCategories = Boolean(activeTabFilter.categories?.length);

  const filters: SearchFilters = {
    ...activeTabFilter,
    // Legacy single category only when the tab has no implicit/user categories.
    category: hasTabCategories
      ? undefined
      : selectedCategories.length > 0
        ? undefined
        : parsed.data?.category,
    sortBy: parsed.data?.sortBy,
    limit: 24,
  };

  const [pageResult, cities, counts] = await Promise.all([
    // Natural-language queries go through semantic search when embeddings
    // are configured; otherwise it falls back to the keyword path.
    parsed.data?.query
      ? searchSemantic(parsed.data.query, 24)
          .then(enrichWithHot)
          .then((items) => ({ items, total: items.length }))
      : searchListingsPage(filters),
    getSearchableCities(),
    Promise.all([
      countActiveTab(tabFiltersMap.todos),
      countActiveTab(tabFiltersMap.remate),
      countActiveTab(tabFiltersMap.flipping),
      countActiveTab(tabFiltersMap.traspaso),
      countActiveTab(tabFiltersMap.comercial),
      countActiveTab(tabFiltersMap.terreno),
    ]),
  ]);

  const { items: listings, total } = pageResult;

  const countByTab: Record<InvestorTab, number> = {
    todos: counts[0],
    remate: counts[1],
    flipping: counts[2],
    traspaso: counts[3],
    comercial: counts[4],
    terreno: counts[5],
  };

  // Mirrors `filters` for the paginated /api/search + markers endpoints so
  // infinite scroll and the map stay in sync with the first server render.
  const filtersQueryString = toQueryString({
    query: parsed.data?.query,
    type: parsed.data?.type,
    categories: hasTabCategories
      ? activeTabFilter.categories!.join(",")
      : undefined,
    category: hasTabCategories
      ? undefined
      : selectedCategories.length > 0
        ? undefined
        : parsed.data?.category,
    dealType: activeTabFilter.dealType,
    minPrice: parsed.data?.minPrice,
    maxPrice: parsed.data?.maxPrice,
    minBedrooms: parsed.data?.minBedrooms,
    city: parsed.data?.city,
    colonia: parsed.data?.colonia,
    minM2: parsed.data?.minM2,
    maxM2: parsed.data?.maxM2,
    sortBy: parsed.data?.sortBy,
    bounds: parsed.data?.bounds,
  });

  const mapSearch = parsed.data?.mapSearch === "true";

  // Presentation style lives in the URL. Legacy `mapSearch=true` still maps
  // to the full-map view; otherwise the Airbnb-style split is the default.
  const view: "list" | "map" | "split" =
    parsed.data?.view ?? (mapSearch ? "map" : "split");

  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== "",
  );

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <PageHeader
          eyebrow="Comprar"
          icon={Home}
          title={<>Buscar <Em>propiedades</Em></>}
          description={`${total} propiedad${total === 1 ? "" : "es"} activa${total === 1 ? "" : "s"}${hasFilters ? " con tus filtros" : " disponibles"}`}
          className="mb-8"
        />

        <ComprarCintillo activeTab={activeTab} counts={countByTab} />

        <div className="mb-8">
          <SearchFiltersForm cities={cities} />
        </div>

        {total === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No hay propiedades que coincidan con esta vista.
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
            gridClassName="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
            canModerate={canModerate}
          />
        )}
      </main>
    </div>
  );
}
