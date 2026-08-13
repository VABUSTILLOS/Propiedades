import { getListingBySlug, getSimilarListings } from "@/modules/listings/queries";
import { getCurrentUser } from "@/modules/auth/session";
import { isFavoriteSaved } from "@/modules/favorites/queries";
import {
  getMyLists,
  getListsContainingProperty,
} from "@/modules/favorites/lists-queries";
import {
  getBenchmark,
  getColoniaDiscount,
  toHotScore,
} from "@/modules/market-data/queries";

export const dynamic = "force-dynamic";

/**
 * Server-derived extras for the split-view detail panel: everything the full
 * `/property/[slug]` page computes on the server that the client-side panel
 * cannot (benchmark, favorite/list membership, inquiry permission and
 * similar listings). The panel already has the full property row.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) {
    return Response.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  const user = await getCurrentUser();

  const [benchmark, discountPct, isSaved, lists, containingListIds, similar] =
    await Promise.all([
      getBenchmark(listing.city, listing.colonia),
      getColoniaDiscount(listing.id),
      user ? isFavoriteSaved(user.id, listing.id) : Promise.resolve(false),
      user ? getMyLists(user.id) : Promise.resolve([]),
      user
        ? getListsContainingProperty(user.id, listing.id)
        : Promise.resolve([]),
      getSimilarListings(listing, 6),
    ]);

  return Response.json({
    benchmark,
    discountPct,
    hotScore: toHotScore(discountPct, listing),
    canInquire: user?.id !== listing.owner_id,
    isSaved,
    lists,
    containingListIds,
    similar,
  });
}
