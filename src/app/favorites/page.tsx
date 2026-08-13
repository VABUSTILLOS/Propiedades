import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getMyFavorites } from "@/modules/favorites/queries";
import { getMyListsWithItems, getListContainmentByProperty } from "@/modules/favorites/lists-queries";
import { FavoritesView } from "@/modules/favorites/components/favorites-view";
import { ShareFavoritesDialog } from "@/modules/favorites/components/share-favorites-dialog";
import { CoShoppingPanel } from "@/modules/co-shopping/components/co-shopping-panel";
import { getChatMessages } from "@/modules/co-shopping/queries";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { Heart } from "lucide-react";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <GuestGate
          title="Guarda tus propiedades favoritas"
          description="Arrastra para ordenar tu shortlist o clasifícala en el Kanban (Top Choice / Plan B / Descartadas). Crea una cuenta para guardar tus favoritos."
          next="/favorites"
        />
      </div>
    );
  }

  const favorites = await getMyFavorites(user.id);
  const listsWithItems = await getMyListsWithItems(user.id);
  const lists = listsWithItems.map((entry) => entry.list);
  const containingByProperty = await getListContainmentByProperty(
    user.id,
    favorites.map((f) => f.property_id),
  );

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
      <PageHeader
        eyebrow="Comprar"
        icon={Heart}
        title={<Em>Favoritos</Em>}
        description="Organiza tu shortlist: arrastra para ordenar en la lista o clasifica en el Kanban (Top Choice / Plan B / Descartadas)."
        className="mb-8"
        actions={
          <>
            {(favorites.length >= 1 || listsWithItems.length > 0) && (
              <ShareFavoritesDialog
                favorites={favorites}
                listsWithItems={listsWithItems}
              />
            )}
            {favorites.length >= 2 && (
              <Link
                href={`/compare?ids=${favorites.map((f) => f.property_id).join(",")}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Comparar
              </Link>
            )}
          </>
        }
      />

      <FavoritesView
        favorites={favorites}
        lists={lists}
        containingByProperty={containingByProperty}
      />

      <div className="mt-8">
        <CoShoppingPanel favorites={favorites} initialChat={initialChat} />
      </div>
    </div>
  );
}
