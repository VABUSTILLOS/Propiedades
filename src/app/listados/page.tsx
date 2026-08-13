import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  countActiveListings,
  searchListingsPage,
  type SearchFilters,
} from "@/modules/search/queries";
import {
  listadosParamsSchema,
  parseBoundsString,
  type ListadosTab,
  type MapBounds,
} from "@/modules/lib/schemas";
import { toQueryString } from "@/modules/search/query-string";
import { ListadosTabs } from "@/modules/listados/components/listados-tabs";
import { SearchResults } from "@/modules/maps/components/search-results";

export const metadata: Metadata = { title: "Listados de propiedades" };

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TAB_LABELS: Record<ListadosTab, string> = {
  todos: "todas las propiedades",
  venta: "propiedades en venta",
  renta: "propiedades en renta",
  tierra: "terrenos",
};

export default async function ListadosPage({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = listadosParamsSchema.safeParse(raw);
  const params = parsed.data;

  const bounds: MapBounds | null = params?.bounds
    ? (parseBoundsString(params.bounds) ?? null)
    : null;

  const baseFilters: Omit<SearchFilters, "limit" | "sortBy"> = {
    query: params?.query,
    minPrice: params?.minPrice,
    maxPrice: params?.maxPrice,
    city: params?.city,
    colonia: params?.colonia,
    minM2: params?.minM2,
    maxM2: params?.maxM2,
    bounds: bounds ?? undefined,
  };

  // Each tab maps to its own query profile; shared refinements (query,
  // price, m², city) apply to every tab so switching tabs keeps context.
  const tabToFilters: Record<ListadosTab, Omit<SearchFilters, "limit" | "sortBy">> = {
    todos: baseFilters,
    venta: { ...baseFilters, type: "sale" },
    renta: { ...baseFilters, type: "rent" },
    tierra: { ...baseFilters, isLand: true },
  };

  const activeTab = params?.tab ?? "todos";
  const filters: SearchFilters = {
    ...tabToFilters[activeTab],
    sortBy: params?.sortBy,
    limit: 24,
  };

  const [pageResult, counts] = await Promise.all([
    searchListingsPage(filters),
    Promise.all([
      countActiveListings(tabToFilters.todos),
      countActiveListings(tabToFilters.venta),
      countActiveListings(tabToFilters.renta),
      countActiveListings(tabToFilters.tierra),
    ]),
  ]);

  const { items: listings, total } = pageResult;

  const countByTab: Record<ListadosTab, number> = {
    todos: counts[0],
    venta: counts[1],
    renta: counts[2],
    tierra: counts[3],
  };

  const filtersQueryString = toQueryString({
    query: params?.query,
    minPrice: params?.minPrice,
    maxPrice: params?.maxPrice,
    city: params?.city,
    colonia: params?.colonia,
    minM2: params?.minM2,
    maxM2: params?.maxM2,
    sortBy: params?.sortBy,
    bounds: params?.bounds,
    type: activeTab === "venta" ? "sale" : activeTab === "renta" ? "rent" : undefined,
    isLand: activeTab === "tierra" ? "true" : undefined,
  });

  const mapSearch = params?.mapSearch === "true";

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <PageHeader
          eyebrow="Explorar"
          icon={LayoutGrid}
          title="Listados"
          description={`${total} ${TAB_LABELS[activeTab]} en el catálogo`}
          className="mb-6"
        />

        <ListadosTabs activeTab={activeTab} counts={countByTab} />

        {total === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No hay propiedades que coincidan con esta vista.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <SearchResults
              key={filtersQueryString}
              basePath="/listados"
              initialItems={listings}
              initialTotal={total}
              filtersQueryString={filtersQueryString}
              mapSearch={mapSearch}
              initialBounds={bounds}
              card="property"
              gridClassName="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
            />
          </div>
        )}
      </main>
    </div>
  );
}
