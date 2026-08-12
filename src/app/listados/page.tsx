import type { Metadata } from "next";

import {
  countActiveListings,
  searchListingsWithHot,
  type SearchFilters,
} from "@/modules/search/queries";
import { listadosParamsSchema, type ListadosTab } from "@/modules/lib/schemas";
import { getCurrentUser } from "@/modules/auth/session";
import { SiteHeader } from "@/modules/home/components/site-header";
import { SiteFooter } from "@/modules/home/components/site-footer";
import { PropertyCard } from "@/modules/home/components/property-card";
import { ListadosTabs } from "@/modules/listados/components/listados-tabs";

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

  const baseFilters: Omit<SearchFilters, "limit" | "sortBy"> = {
    query: params?.query,
    minPrice: params?.minPrice,
    maxPrice: params?.maxPrice,
    city: params?.city,
    colonia: params?.colonia,
    minM2: params?.minM2,
    maxM2: params?.maxM2,
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

  const [user, listings, counts] = await Promise.all([
    getCurrentUser(),
    searchListingsWithHot(filters),
    Promise.all([
      countActiveListings(tabToFilters.todos),
      countActiveListings(tabToFilters.venta),
      countActiveListings(tabToFilters.renta),
      countActiveListings(tabToFilters.tierra),
    ]),
  ]);

  const countByTab: Record<ListadosTab, number> = {
    todos: counts[0],
    venta: counts[1],
    renta: counts[2],
    tierra: counts[3],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Listados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {listings.length} {TAB_LABELS[activeTab]} en el catálogo
          </p>
        </div>

        <ListadosTabs activeTab={activeTab} counts={countByTab} />

        {listings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No hay propiedades que coincidan con esta vista.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <PropertyCard
                key={listing.id}
                listing={listing}
                hotScore={listing.hotScore}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
