import type { Metadata } from "next";
import Link from "next/link";

import {
  getSearchableCities,
  searchListings,
  type SearchFilters,
} from "@/modules/search/queries";
import { SearchFiltersForm } from "@/modules/search/components/search-filters";
import { SearchResults } from "@/modules/maps/components/search-results";
import { searchParamsSchema } from "@/modules/lib/schemas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Search properties" };

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);

  const filters: SearchFilters = {
    query: parsed.data?.query,
    type: parsed.data?.type,
    minPrice: parsed.data?.minPrice,
    maxPrice: parsed.data?.maxPrice,
    city: parsed.data?.city,
    colonia: parsed.data?.colonia,
    sortBy: parsed.data?.sortBy,
    limit: 24,
  };

  const [listings, cities] = await Promise.all([
    searchListings(filters),
    getSearchableCities(),
  ]);

  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== "",
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Search properties</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {listings.length} active listing{listings.length === 1 ? "" : "s"}
          {hasFilters ? " matching your filters" : " available"}
        </p>
      </div>

      <div className="mb-8">
        <SearchFiltersForm cities={cities} />
      </div>

      {listings.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No properties match your search.
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <SearchResultCard
                key={listing.id}
                title={listing.title}
                slug={listing.slug}
                city={`${listing.colonia}, ${listing.city}`}
                price={listing.price}
                currency={listing.currency}
                type={listing.type}
                image={listing.images?.[0] ?? null}
                score={listing.property_score}
              />
            ))}
          </div>
        </SearchResults>
      )}
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
  image,
  score,
}: {
  title: string;
  slug: string;
  city: string;
  price: number;
  currency: string;
  type: "sale" | "rent";
  image: string | null;
  score: number | null;
}) {
  return (
    <Card className="overflow-hidden">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={title}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          No photo
        </div>
      )}

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/property/${slug}`}
            className="font-semibold leading-snug hover:underline"
          >
            {title}
          </Link>
          {score != null && (
            <Badge variant="outline">score {score.toFixed(1)}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{city}</p>
        <p className="text-sm font-semibold">
          ${price.toLocaleString()}{" "}
          <span className="font-normal text-muted-foreground">
            {currency} · {type === "rent" ? "rent" : "sale"}
          </span>
        </p>
      </div>
    </Card>
  );
}
