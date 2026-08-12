import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getListItems } from "@/modules/favorites/lists-queries";
import { ListDetailView } from "@/modules/favorites/components/list-detail-view";
import type { FavoriteListWithMeta } from "@/modules/favorites/lists-queries";

export const metadata: Metadata = { title: "Lista de favoritos" };

export default async function FavoriteListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <GuestGate
          title="Guarda tus propiedades favoritas"
          description="Crea listas para organizar tus propiedades favoritas — por ejemplo 'Casas en Cancún' o 'Para rentar'."
          next="/favorites"
        />
      </div>
    );
  }

  const { listId } = await params;
  const { list, items } = await getListItems(user.id, listId);

  if (!list) {
    notFound();
  }

  const meta: FavoriteListWithMeta = {
    ...list,
    itemCount: items.length,
    preview: [],
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <ListDetailView list={meta} items={items} />
    </div>
  );
}
