import { apiSearchParamsSchema, parseBoundsString } from "@/modules/lib/schemas";
import type { SearchFilters } from "@/modules/search/queries";
import { enrichWithHot, searchListingsPage } from "@/modules/search/queries";
import { searchSemantic } from "@/modules/ai/embeddings";

export const dynamic = "force-dynamic";

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

  if (p.query) {
    const rows = await searchSemantic(p.query, limit);
    const items = await enrichWithHot(rows);
    return Response.json({
      items,
      total: items.length,
      offset: 0,
      limit,
      hasMore: false,
    });
  }

  const filters: SearchFilters = {
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

  const { items, total } = await searchListingsPage(filters);
  return Response.json({
    items,
    total,
    offset,
    limit,
    hasMore: offset + items.length < total,
  });
}
