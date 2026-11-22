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
import {
  getMyFavoriteIds,
  getOwnerFavoriteIds,
} from "@/modules/favorites/queries";
import { isEditorMode } from "@/modules/admin/editor-mode";

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
  const canEdit = canModerate && (await isEditorMode());

  // Multi-select property types (`categories` CSV). When present it wins over
  // the legacy single `category` param so both are never applied at once.
  const selectedCategories = parseCategoriesParam(parsed.data?.categories);

  // Opportunity tab from the cintillo (todos|remate|flipping|traspaso|comercial|terreno).
  const activeTab: InvestorTab = parsed.data?.tab ?? "todos";

  // Shared refinements (query, price, m², city) apply to every tab so
  // switching tabs keeps context; the cintillo counts react to them too.
  // "Comprar" page only shows sale listings — rentals live on /rentas.
  const baseFilters: Omit<SearchFilters, "limit" | "sortBy"> = {
    query: parsed.data?.query,
    type: "sale",
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

  // «Favoritas» tab (Victor's ask, 2026-11-22): favorites behave like one
  // more property-type filter over the normal listings — same 3 views,
  // filters and map — not a separate section. Signed-in users see their
  // own favorites; visitors see the site owner's (admin's) favorites, so
  // anyone can open the tab and see the curated set.
  const savedIds = user ? await getMyFavoriteIds(user.id) : null;
  const favoriteIds: string[] = savedIds
    ? [...savedIds]
    : await getOwnerFavoriteIds();
  tabFiltersMap.favoritas = {
    ...tabFiltersMap.favoritas,
    favoriteIds,
  };

  const activeTabFilter = tabFiltersMap[activeTab];
  const hasTabCategories = Boolean(activeTabFilter.categories?.length);

  // Returning from a property page, `loaded` re-renders everything the
  // user had already paged in (24 by default, capped at 500).
  const initialLimit = Math.min(Math.max(parsed.data?.loaded ?? 24, 24), 500);

  const filters: SearchFilters = {
    ...activeTabFilter,
    // Legacy single category only when the tab has no implicit/user categories.
    category: hasTabCategories
      ? undefined
      : selectedCategories.length > 0
        ? undefined
        : parsed.data?.category,
    sortBy: parsed.data?.sortBy,
    limit: initialLimit,
  };

  const [pageResult, cities, counts] = await Promise.all([
    // Natural-language queries go through semantic search when embeddings
    // are configured; otherwise it falls back to the keyword path.
    parsed.data?.query
      ? searchSemantic(parsed.data.query, initialLimit)
          .then(enrichWithHot)
          .then((items) => {
            // Semantic results carry no structured filters; on the
            // «Favoritas» tab keep only the user's favorites.
            const visible =
              activeTab === "favoritas"
                ? items.filter((item) => savedIds?.has(item.id) ?? false)
                : items;
            return { items: visible, total: visible.length };
          })
      : searchListingsPage(filters),
    getSearchableCities(),
    Promise.all([
      countActiveTab(tabFiltersMap.todos),
      countActiveTab(tabFiltersMap.favoritas),
      countActiveTab(tabFiltersMap.remate),
      countActiveTab(tabFiltersMap.flipping),
      countActiveTab(tabFiltersMap.traspaso),
      countActiveTab(tabFiltersMap.comercial),
      countActiveTab(tabFiltersMap.terreno),
    ]),
  ]);

  const { items: rawListings, total } = pageResult;

  // Mark the cards the current user already saved as favorites (heart state).
  const listings = rawListings.map((item) => ({
    ...item,
    saved: savedIds?.has(item.id) ?? false,
  }));

  const countByTab: Record<InvestorTab, number> = {
    todos: counts[0],
    favoritas: counts[1],
    remate: counts[2],
    flipping: counts[3],
    traspaso: counts[4],
    comercial: counts[5],
    terreno: counts[6],
  };

  // Mirrors `filters` for the paginated /api/search + markers endpoints so
  // infinite scroll and the map stay in sync with the first server render.
  const filtersQueryString = toQueryString({
    query: parsed.data?.query,
    type: "sale",
    favorites: activeTab === "favoritas" ? "true" : undefined,
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
              {activeTab === "favoritas"
                ? user
                  ? "Aún no tienes favoritas en venta. Toca el corazón en una propiedad para agregarla aquí."
                  : "Todavía no hay propiedades favoritas en venta."
                : "No hay nada que valga la pena con esa vista. ¿Relajamos la búsqueda?"}
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
            canEdit={canEdit}
          />
        )}
      </main>
    </div>
  );
}
