import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { CoShoppingChatRow } from "@/modules/lib/database.types";

export type ChatMessageWithSender = CoShoppingChatRow & {
  sender_name: string;
};

/**
 * Messages for a shared favorite, oldest first. RLS restricts to
 * participants of the shared shortlist.
 */
export async function getChatMessages(
  favoriteId: string,
): Promise<ChatMessageWithSender[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("co_shopping_chat")
    .select("*, sender:profiles(full_name)")
    .eq("favorite_id", favoriteId)
    .order("created_at", { ascending: true })
    .returns<
      Array<
        CoShoppingChatRow & { sender: { full_name: string } | null }
      >
    >();

  return (data ?? []).map((m) => ({
    ...m,
    sender_name: m.sender?.full_name ?? "Co-buyer",
  }));
}
