"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, failAuth, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { transactionCreateSchema, transactionTransitionSchema } from "@/modules/lib/schemas";
import { canTransition } from "@/modules/transactions/state-machine";
import type { TransactionState } from "@/modules/lib/database.types";

/**
 * Open a new transaction (inquiry) on a property.
 * The buyer becomes transaction.buyer_id; the listing owner is the counterparty.
 * RLS prevents duplicates-in-flight for the same buyer+property.
 */
export async function createTransaction(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const parsed = parseInput(transactionCreateSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id, status")
    .eq("id", parsed.data.propertyId)
    .limit(1)
    .returns<{ id: string; owner_id: string; status: string }[]>();

  const listing = property?.[0];
  if (!listing || listing.status !== "active") {
    return fail("La propiedad no está disponible para consultas.");
  }
  if (listing.owner_id === user.id) {
    return fail("No puedes consultar tu propio listado.");
  }

  // Prevent duplicate open transactions for the same buyer + property.
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("property_id", parsed.data.propertyId)
    .eq("buyer_id", user.id)
    .not("state", "in", '("closed","canceled")')
    .limit(1);

  const existingTransaction = existing?.[0];
  if (existingTransaction) {
    return ok({ id: existingTransaction.id });
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      property_id: parsed.data.propertyId,
      buyer_id: user.id,
      listing_owner_id: listing.owner_id,
      state: "inquired",
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  // Seed the thread so a brand-new inquiry is never empty.
  await supabase.from("messages").insert({
    transaction_id: data.id,
    sender_id: user.id,
    content: "Inquiry started.",
    is_system_event: true,
    action_payload: null,
  });

  revalidatePath("/transactions");
  return ok({ id: data.id });
}

/**
 * Transition a transaction to `toState`, validating against the state
 * machine. Only transaction participants can act (RLS + ownership check).
 * Every transition writes a system message into the thread.
 */
export async function transitionTransaction(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const parsed = parseInput(transactionTransitionSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("transactions")
    .select("id, property_id, buyer_id, listing_owner_id, state")
    .eq("id", parsed.data.transactionId)
    .returns<
      {
        id: string;
        property_id: string;
        buyer_id: string;
        listing_owner_id: string;
        state: TransactionState;
      }[]
    >()
    .limit(1);

  const transaction = rows?.[0];
  if (!transaction) {
    return fail("Transaction not found.");
  }

  const isParticipant =
    transaction.buyer_id === user.id ||
    transaction.listing_owner_id === user.id;
  if (!isParticipant) {
    return fail("No formas parte de esta transacción.");
  }

  if (!canTransition(transaction.state, parsed.data.toState)) {
    return fail(
      `Cannot move from "${transaction.state}" to "${parsed.data.toState}".`,
    );
  }

  const { error } = await supabase
    .from("transactions")
    .update({ state: parsed.data.toState, last_transition_at: new Date().toISOString() })
    .eq("id", transaction.id);

  if (error) {
    return fail(error.message);
  }

  // System event so the thread reflects the transition. Terminal moves use
  // their dedicated action type; everything else renders a status-change card.
  const payloadType =
    parsed.data.toState === "in_escrow"
      ? "escrow_started"
      : parsed.data.toState === "closed"
        ? "deal_closed"
        : parsed.data.toState === "canceled"
          ? "canceled"
          : "status_change";

  await supabase.from("messages").insert({
    transaction_id: transaction.id,
    sender_id: user.id,
    content: `Transaction moved to "${parsed.data.toState}".`,
    is_system_event: true,
    action_payload: {
      type: payloadType,
      data: {
        from: transaction.state,
        to: parsed.data.toState,
      },
    },
  });

  revalidatePath(`/transactions/${transaction.id}`);
  revalidatePath("/transactions");
  return ok({ id: transaction.id });
}
