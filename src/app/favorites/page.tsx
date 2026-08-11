import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/modules/auth/session";
import { getMyFavorites } from "@/modules/favorites/queries";
import { FavoritesView } from "@/modules/favorites/components/favorites-view";
import { CoShoppingPanel } from "@/modules/co-shopping/components/co-shopping-panel";
import { getChatMessages } from "@/modules/co-shopping/queries";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const user = await requireUser();
  const favorites = await getMyFavorites(user.id);

  const initialChat = Object.fromEntries(
    await Promise.all(
      favorites.map(async (f) => {
        const messages = await getChatMessages(f.id);
        return [f.id, messages] as const;
      }),
    ),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organiza tu shortlist: arrastra para ordenar en la lista o clasifica en el Kanban (Top Choice / Plan B / Descartadas).
          </p>
        </div>
        {favorites.length >= 2 && (
          <Link
            href={`/compare?ids=${favorites.map((f) => f.property_id).join(",")}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Comparar
          </Link>
        )}
      </div>

      <FavoritesView favorites={favorites} />

      <div className="mt-8">
        <CoShoppingPanel favorites={favorites} initialChat={initialChat} />
      </div>
    </div>
  );
}
