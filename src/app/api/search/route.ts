import { apiSearchParamsSchema, parseBoundsString } from "@/modules/lib/schemas";
import type { ListingWithHot, SearchFilters } from "@/modules/search/queries";
import { enrichWithHot, searchListingsPage } from "@/modules/search/queries";
import { searchSemantic } from "@/modules/ai/embeddings";
import { getCurrentUser } from "@/modules/auth/session";
import {
  getMyFavoriteIds,
  getOwnerFavoriteIds,
} from "@/modules/favorites/queries";

export const dynamic = "force-dynamic";

/** Mark each item with the current user's favorite state (card hearts). */
async function withSavedFlags(items: ListingWithHot[]): Promise<ListingWithHot[]> {
  const user = await getCurrentUser();
  if (!user) return items;
  const savedIds = await getMyFavoriteIds(user.id);
  return items.map((item) => ({ ...item, saved: savedIds.has(item.id) }));
}

/**
 * Paginated listing search backed by the same server query layer as the
 * pages, so infinite scroll and the initial render never diverge.
 *
 * - No `query` → structured filters + bounds + offset/limit with an exact
 *   count and `hasMore`.
 * - With `query` → semantic search (no offset; total = returned items and
 *   hasMore = false, since the semantic path has no count).
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
  const offset = p.offset ?? 0;
  const limit = p.limit ?? 24;

  // «Favoritas» tab: restrict to the signed-in user's favorite ids;
  // visitors get the site owner's (admin's) favorites instead.
  const favoritesOnly = p.favorites === "true";
  let favoriteIds: string[] | undefined;
  if (favoritesOnly) {
    const user = await getCurrentUser();
    favoriteIds = user
      ? [...(await getMyFavoriteIds(user.id))]
      : await getOwnerFavoriteIds();
  }

  if (p.query) {
    const rows = await searchSemantic(p.query, limit);
    let items = await withSavedFlags(await enrichWithHot(rows));
    if (favoriteIds !== undefined) {
      const allowed = new Set(favoriteIds);
      items = items.filter((item) => allowed.has(item.id));
    }
    return Response.json({
      items,
      total: items.length,
      offset: 0,
      limit,
      hasMore: false,
    });
  }

  const filters: SearchFilters = {
    favoriteIds,
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
    sortBy: p.sortBy,
    bounds: p.bounds ? parseBoundsString(p.bounds) ?? undefined : undefined,
    offset,
    limit,
  };

  const { items: pageItems, total } = await searchListingsPage(filters);
  const items = await withSavedFlags(pageItems);
  return Response.json({
    items,
    total,
    offset,
    limit,
    hasMore: offset + items.length < total,
  });
}
