import type { Metadata } from "next";

import { requireUser } from "@/modules/auth/session";
import { getMyFavorites } from "@/modules/favorites/queries";
import { FavoritesView } from "@/modules/favorites/components/favorites-view";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const user = await requireUser();
  const favorites = await getMyFavorites(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organiza tu shortlist: arrastra para ordenar en la lista o clasifica en el Kanban (Top Choice / Plan B / Descartadas).
        </p>
      </div>

      <FavoritesView favorites={favorites} />
    </div>
  );
}
