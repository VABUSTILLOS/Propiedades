import type { Metadata } from "next";

import { requireUser } from "@/modules/auth/session";
import { getMyFavorites } from "@/modules/favorites/queries";
import { FavoritesList } from "@/modules/favorites/components/favorites-list";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const user = await requireUser();
  const favorites = await getMyFavorites(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag to rank your shortlist. Tier 1 is your top pick.
        </p>
      </div>

      <FavoritesList initialFavorites={favorites} />
    </div>
  );
}
