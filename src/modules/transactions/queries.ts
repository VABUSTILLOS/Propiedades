import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { TransactionsRow } from "@/modules/lib/database.types";

/**
 * List transactions the current user is part of (buyer or listing owner).
 * RLS enforces participant-only visibility.
 */
export async function getMyTransactions(
  userId: string,
): Promise<TransactionsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("transactions")
    .select("*")
    .or(`buyer_id.eq.${userId},listing_owner_id.eq.${userId}`)
    .order("last_transition_at", { ascending: false })
    .returns<TransactionsRow[]>();

  return rows ?? [];
}

/**
 * Fetch a single transaction by id — participant-only.
 */
export async function getTransactionById(
  transactionId: string,
  userId: string,
): Promise<TransactionsRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .or(`buyer_id.eq.${userId},listing_owner_id.eq.${userId}`)
    .returns<TransactionsRow[]>()
    .limit(1);

  return rows?.[0] ?? null;
}
