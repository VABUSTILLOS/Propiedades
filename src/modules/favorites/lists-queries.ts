import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { FavoriteListsRow } from "@/modules/lib/database.types";

/**
 * A list plus the derived data needed to render it (count + thumbnail
 * previews derived from the linked favorites).
 */
export type FavoriteListWithMeta = FavoriteListsRow & {
  itemCount: number;
  preview: Array<{ id: string; title: string; imageUrl: string | null }>;
};

const propertyPreviewFields =
  "id, slug, title, city, colonia, price, currency, images";

export type ListItemProperty = {
  id: string;
  slug: string;
  title: string;
  city: string;
  colonia: string;
  price: number;
  currency: string;
  images: string[] | null;
};

export type FavoriteListItemWithProperty = {
  id: string;
  list_id: string;
  favorite_id: string;
  position: number;
  created_at: string;
  property: ListItemProperty | null;
};

/**
 * The user's lists, ordered by creation, with an item count and up to three
 * property previews for the grid tile.
 */
export async function getMyLists(
  userId: string,
): Promise<FavoriteListWithMeta[]> {
  const supabase = await createSupabaseServerClient();

  const { data: lists } = await supabase
    .from("favorite_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<FavoriteListsRow[]>();

  if (!lists?.length) return [];

  const listIds = lists.map((l) => l.id);

  const { data: items } = await supabase
    .from("favorite_list_items")
    .select(
      `list_id, favorite:buyer_favorites(property:properties(${propertyPreviewFields}))`,
    )
    .in("list_id", listIds)
    .order("position", { ascending: true })
    .returns<
      Array<{
        list_id: string;
        favorite: { property: ListItemProperty | null } | null;
      }>
    >();

  const grouped = new Map<string, ListItemProperty[]>();
  for (const item of items ?? []) {
    const property = item.favorite?.property;
    if (!property) continue;
    const group = grouped.get(item.list_id) ?? [];
    if (group.length < 3) group.push(property);
    grouped.set(item.list_id, group);
  }

  return lists.map((list) => ({
    ...list,
    itemCount: grouped.get(list.id)?.length ?? 0,
    preview: (grouped.get(list.id) ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      imageUrl: p.images?.[0] ?? null,
    })),
  }));
}

/**
 * Every list of the user together with all of its items (property joined).
 * Unlike `getMyLists`, the preview is not capped — this is used to build
 * consolidated WhatsApp share messages. One grouped fetch, no N+1.
 */
export type ListWithItems = {
  list: FavoriteListWithMeta;
  items: ListItemProperty[];
};

export async function getMyListsWithItems(
  userId: string,
): Promise<ListWithItems[]> {
  const supabase = await createSupabaseServerClient();

  const { data: lists } = await supabase
    .from("favorite_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<FavoriteListsRow[]>();

  if (!lists?.length) return [];

  const { data: items } = await supabase
    .from("favorite_list_items")
    .select(
      `list_id, position, favorite:buyer_favorites(property:properties(${propertyPreviewFields}))`,
    )
    .in(
      "list_id",
      lists.map((l) => l.id),
    )
    .order("position", { ascending: true })
    .returns<
      Array<{
        list_id: string;
        favorite: { property: ListItemProperty | null } | null;
      }>
    >();

  const grouped = new Map<string, ListItemProperty[]>();
  for (const item of items ?? []) {
    const property = item.favorite?.property;
    if (!property) continue;
    const group = grouped.get(item.list_id) ?? [];
    group.push(property);
    grouped.set(item.list_id, group);
  }

  return lists.map((list) => {
    const listItems = grouped.get(list.id) ?? [];
    return {
      list: {
        ...list,
        itemCount: listItems.length,
        preview: listItems.slice(0, 3).map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.images?.[0] ?? null,
        })),
      },
      items: listItems,
    };
  });
}

/**
 * All items inside a single list, joined to their property. Empty list ids
 * and lists the user does not own return [].
 */
export async function getListItems(
  userId: string,
  listId: string,
): Promise<{ list: FavoriteListsRow | null; items: FavoriteListItemWithProperty[] }> {
  const supabase = await createSupabaseServerClient();

  const { data: list } = await supabase
    .from("favorite_lists")
    .select("*")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle<FavoriteListsRow>();

  if (!list) {
    return { list: null, items: [] };
  }

  const { data: items } = await supabase
    .from("favorite_list_items")
    .select(
      `id, list_id, favorite_id, position, created_at,
       property:buyer_favorites(property:properties(${propertyPreviewFields}))`,
    )
    .eq("list_id", listId)
    .order("position", { ascending: true })
    .returns<
      Array<{
        id: string;
        list_id: string;
        favorite_id: string;
        position: number;
        created_at: string;
        property: { property: ListItemProperty | null } | null;
      }>
    >();

  return {
    list,
    items: (items ?? []).map((item) => ({
      id: item.id,
      list_id: item.list_id,
      favorite_id: item.favorite_id,
      position: item.position,
      created_at: item.created_at,
      property: item.property?.property ?? null,
    })),
  };
}

/**
 * The ids of the user's lists that already contain a property — used to
 * pre-check the "Añadir a lista" dialog.
 */
export async function getListsContainingProperty(
  userId: string,
  propertyId: string,
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data: favorites } = await supabase
    .from("buyer_favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .limit(1);

  const favoriteId = favorites?.[0]?.id;
  if (!favoriteId) return [];

  const { data: items } = await supabase
    .from("favorite_list_items")
    .select("list_id")
    .eq("favorite_id", favoriteId)
    .returns<{ list_id: string }[]>();

  return (items ?? []).map((i) => i.list_id);
}

/**
 * property_id -> list ids that contain it, for many properties at once.
 * Used to pre-check the "Añadir a lista" dialog in the favorites rows.
 */
export async function getListContainmentByProperty(
  userId: string,
  propertyIds: string[],
): Promise<Record<string, string[]>> {
  if (propertyIds.length === 0) return {};
  const supabase = await createSupabaseServerClient();

  const { data: favorites } = await supabase
    .from("buyer_favorites")
    .select("id, property_id")
    .eq("user_id", userId)
    .in("property_id", propertyIds)
    .returns<{ id: string; property_id: string }[]>();

  const favoriteIds = (favorites ?? []).map((f) => f.id);
  if (favoriteIds.length === 0) return {};

  const { data: items } = await supabase
    .from("favorite_list_items")
    .select("list_id, favorite_id")
    .in("favorite_id", favoriteIds)
    .returns<{ list_id: string; favorite_id: string }[]>();

  const byFavorite = new Map<string, string[]>();
  for (const item of items ?? []) {
    const ids = byFavorite.get(item.favorite_id) ?? [];
    ids.push(item.list_id);
    byFavorite.set(item.favorite_id, ids);
  }

  const result: Record<string, string[]> = {};
  for (const favorite of favorites ?? []) {
    result[favorite.property_id] = byFavorite.get(favorite.id) ?? [];
  }
  return result;
}
