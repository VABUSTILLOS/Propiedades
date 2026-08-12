import type { Metadata } from "next";
import Link from "next/link";

import {
  enrichWithHot,
  getSearchableCities,
  searchListingsPage,
  type SearchFilters,
} from "@/modules/search/queries";
import { searchSemantic } from "@/modules/ai/embeddings";
import { SearchFiltersForm } from "@/modules/search/components/search-filters";
import { SearchResults } from "@/modules/maps/components/search-results";
import { parseBoundsString,
  searchParamsSchema,
  type MapBounds,
} from "@/modules/lib/schemas";
import { getCurrentUser } from "@/modules/auth/session";
import { toQueryString } from "@/modules/search/query-string";
import { SiteHeader } from "@/modules/home/components/site-header";
import { SiteFooter } from "@/modules/home/components/site-footer";
import { Building2, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Buscar propiedades" };

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

  const filters: SearchFilters = {
    query: parsed.data?.query,
    type: parsed.data?.type,
    category: parsed.data?.category,
    // Comprar focuses on person-to-person home sales; default to direct
    // sales and exclude investment vehicles (remates, flips, traspasos)
    // unless the user explicitly asks for one.
    dealType: parsed.data?.dealType ?? "venta_directa",
    minPrice: parsed.data?.minPrice,
    maxPrice: parsed.data?.maxPrice,
    city: parsed.data?.city,
    colonia: parsed.data?.colonia,
    bounds: bounds ?? undefined,
    sortBy: parsed.data?.sortBy,
    limit: 24,
  };

  const [user, pageResult, cities] = await Promise.all([
    getCurrentUser(),
    // Natural-language queries go through semantic search when embeddings
    // are configured; otherwise it falls back to the keyword path.
    parsed.data?.query
      ? searchSemantic(parsed.data.query, 24)
          .then(enrichWithHot)
          .then((items) => ({ items, total: items.length }))
      : searchListingsPage(filters),
    getSearchableCities(),
  ]);

  const { items: listings, total } = pageResult;

  // Mirrors `filters` for the paginated /api/search + markers endpoints so
  // infinite scroll and the map stay in sync with the first server render.
  const filtersQueryString = toQueryString({
    query: parsed.data?.query,
    type: parsed.data?.type,
    category: parsed.data?.category,
    dealType: parsed.data?.dealType ?? "venta_directa",
    minPrice: parsed.data?.minPrice,
    maxPrice: parsed.data?.maxPrice,
    city: parsed.data?.city,
    colonia: parsed.data?.colonia,
    minM2: parsed.data?.minM2,
    maxM2: parsed.data?.maxM2,
    sortBy: parsed.data?.sortBy,
    bounds: parsed.data?.bounds,
  });

  const mapSearch = parsed.data?.mapSearch === "true";

  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== "",
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Buscar propiedades
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} propiedad{total === 1 ? "" : "es"}{" "}
                activa{total === 1 ? "" : "s"}
                {hasFilters ? " con tus filtros" : " disponibles"}
              </p>
            </div>

            <div className="inline-flex rounded-full border bg-muted/40 p-1">
              <Link
                href="/search"
                aria-current="page"
                className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm"
              >
                <Landmark className="size-4" />
                Modo hogar
              </Link>
              <Link
                href="/investor"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                  "text-muted-foreground hover:text-foreground",
                )}
              >
                <Building2 className="size-4" />
                Inversionista
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <SearchFiltersForm cities={cities} />
        </div>

        {total === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No hay propiedades que coincidan con tu búsqueda.
            </p>
          </div>
        ) : (
          <SearchResults
            key={filtersQueryString}
            initialItems={listings}
            initialTotal={total}
            filtersQueryString={filtersQueryString}
            mapSearch={mapSearch}
            initialBounds={bounds}
            card="search"
            gridClassName="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
