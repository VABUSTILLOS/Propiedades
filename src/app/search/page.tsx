import type { Metadata } from "next";
import Link from "next/link";

import {
  getSearchableCities,
  searchListingsPage,
  type SearchFilters,
} from "@/modules/search/queries";
import { searchSemantic } from "@/modules/ai/embeddings";
import { SearchFiltersForm } from "@/modules/search/components/search-filters";
import { SearchResults } from "@/modules/maps/components/search-results";
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import {
  parseBoundsString,
  searchParamsSchema,
  type MapBounds,
} from "@/modules/lib/schemas";
import { getCurrentUser } from "@/modules/auth/session";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
  isFinanciable,
} from "@/modules/lib/real-estate";
import type { PropertyDealType } from "@/modules/lib/database.types";
import { toQueryString } from "@/modules/search/query-string";
import { SiteHeader } from "@/modules/home/components/site-header";
import { SiteFooter } from "@/modules/home/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
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
                {listings.length} propiedad{listings.length === 1 ? "" : "es"}{" "}
                activa{listings.length === 1 ? "" : "s"}
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

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No hay propiedades que coincidan con tu búsqueda.
            </p>
          </div>
        ) : (
          <SearchResults
            results={listings.map((listing) => ({
              id: listing.id,
              title: listing.title,
              slug: listing.slug,
              city: `${listing.colonia}, ${listing.city}`,
              price: listing.price,
              currency: listing.currency,
              type: listing.type,
              image: listing.images?.[0] ?? null,
              score: listing.property_score,
              lat: listing.lat,
              lng: listing.lng,
            }))}
          >
            <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <SearchResultCard
                  key={listing.id}
                  title={listing.title}
                  slug={listing.slug}
                  city={`${listing.colonia}, ${listing.city}`}
                  price={listing.price}
                  currency={listing.currency}
                  type={listing.type}
                  dealType={listing.deal_type}
                  image={listing.images?.[0] ?? null}
                  score={listing.property_score}
                  hotScore={listing.hotScore}
                />
              ))}
            </div>
          </SearchResults>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function SearchResultCard({
  title,
  slug,
  city,
  price,
  currency,
  type,
  dealType,
  image,
  score,
  hotScore,
}: {
  title: string;
  slug: string;
  city: string;
  price: number;
  currency: string;
  type: "sale" | "rent";
  dealType: PropertyDealType;
  image: string | null;
  score: number | null;
  hotScore: number | null;
}) {
  const showCosts = type === "sale" && price > 0;
  const financiable = isFinanciable(dealType);

  return (
    <div className="group block motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md">
      <Link href={`/property/${slug}`} className="block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">
            Sin foto
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge className="rounded-full shadow-sm">
            {type === "rent" ? "Renta" : "Venta"}
          </Badge>
        </div>
        <ScoreBadge
          score={score}
          solid
          className="absolute right-3 top-3 rounded-full"
        />
      </div>

      <div className="space-y-1.5 pt-3">
        <h3 className="line-clamp-1 font-semibold leading-snug group-hover:underline">
          {title}
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">{city}</p>
        <p className="font-bold">
          ${price.toLocaleString()}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {currency} · {type === "rent" ? "renta" : "venta"}
          </span>
        </p>
        <HotnessGauge score={hotScore} />
      </div>
      </Link>

      {showCosts && (
        <div className="space-y-1 pt-3">
          <p className="text-xs text-muted-foreground">
            Predial est. {formatMxn(estimatePredial(price))}/año · Escrituración
            est. {formatMxn(estimateEscrituracion(price))}
          </p>
          {financiable && (
            <Link
              href="/preapproval"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
            >
              Precalificate para un crédito
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
