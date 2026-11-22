import { apiSearchParamsSchema, parseBoundsString } from "@/modules/lib/schemas";
import type { SearchFilters } from "@/modules/search/queries";
import { getListingMarkers } from "@/modules/search/queries";
import { getCurrentUser } from "@/modules/auth/session";
import {
  getMyFavoriteIds,
  getOwnerFavoriteIds,
} from "@/modules/favorites/queries";

export const dynamic = "force-dynamic";

/**
 * Map pins for the Airbnb-style city map: all listings matching the current
 * filters (bounds included), capped at 500 server-side. The map never
 * paginates — a wide viewport should show every matching property.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const parsed = apiSearchParamsSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json(
      { error: "Parámetros inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const p = parsed.data;

  // «Favoritas» tab: pins restricted to the signed-in user's favorites;
  // visitors get the site owner's (admin's) favorites instead.
  let favoriteIds: string[] | undefined;
  if (p.favorites === "true") {
    const user = await getCurrentUser();
    favoriteIds = user
      ? [...(await getMyFavoriteIds(user.id))]
      : await getOwnerFavoriteIds();
  }

  const filters: Omit<SearchFilters, "limit" | "sortBy"> = {
    favoriteIds,
    query: p.query,
    type: p.type,
    category: p.category,
    categories: p.categories
      ? (p.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean) as SearchFilters["categories"])
      : undefined,
    dealType: p.dealType,
    isLand: p.isLand === "true" ? true : undefined,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    city: p.city,
    colonia: p.colonia,
    minM2: p.minM2,
    maxM2: p.maxM2,
    minBedrooms: p.minBedrooms,
    bounds: p.bounds ? parseBoundsString(p.bounds) ?? undefined : undefined,
  };

  const markers = await getListingMarkers(filters);
  return Response.json({ markers });
}
