import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { MessagesRow } from "@/modules/lib/database.types";

/**
 * Messages for a transaction thread, oldest first. RLS scopes access to
 * transaction participants.
 */
export async function getTransactionMessages(
  transactionId: string,
): Promise<MessagesRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("messages")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true })
    .returns<MessagesRow[]>();

  return rows ?? [];
}
