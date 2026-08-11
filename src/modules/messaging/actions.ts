"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import {
  messageCreateSchema,
  systemEventSchema,
  type MessageActionType,
} from "@/modules/lib/schemas";
import type { Json } from "@/modules/lib/database.types";

/**
 * Send a message in a transaction thread. Only participants can post
 * (checked server-side + enforced by RLS on the messages table).
 *
 * Users can attach an `action_payload` (e.g. a tour_request or
 * offer_submitted card) but never forge `is_system_event` — that flag is
 * forced to false here and only `sendSystemEvent` writes system rows.
 */
export async function sendMessage(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(messageCreateSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: txRows } = await supabase
    .from("transactions")
    .select("buyer_id, listing_owner_id")
    .eq("id", parsed.data.transactionId)
    .returns<{ buyer_id: string; listing_owner_id: string }[]>()
    .limit(1);

  const tx = txRows?.[0];
  if (!tx) {
    return fail("Transaction not found.");
  }
  const isParticipant =
    tx.buyer_id === user.id || tx.listing_owner_id === user.id;
  if (!isParticipant) {
    return fail("You are not part of this transaction.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      transaction_id: parsed.data.transactionId,
      sender_id: user.id,
      content: parsed.data.content,
      is_system_event: false,
      action_payload: (parsed.data.action_payload as unknown as Json | null) ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath(`/transactions/${parsed.data.transactionId}`);
  return ok({ id: data.id });
}

/** Human-readable line for a system event with no typed payload. */
const SYSTEM_EVENT_TEXT: Record<MessageActionType, string> = {
  tour_request: "A tour was requested.",
  tour_accepted: "The tour was confirmed.",
  offer_submitted: "An offer was submitted.",
  offer_accepted: "The offer was accepted.",
  escrow_started: "Escrow has started.",
  deal_closed: "The deal was closed.",
  status_change: "The transaction state changed.",
  canceled: "The transaction was canceled.",
};

/**
 * Emit a system event (is_system_event=true) with a structured
 * `action_payload` into the transaction thread. Only participants can
 * trigger it; system rows cannot be forged via `sendMessage`.
 */
export async function sendSystemEvent(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(systemEventSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: txRows } = await supabase
    .from("transactions")
    .select("buyer_id, listing_owner_id")
    .eq("id", parsed.data.transactionId)
    .returns<{ buyer_id: string; listing_owner_id: string }[]>()
    .limit(1);

  const tx = txRows?.[0];
  if (!tx) {
    return fail("Transaction not found.");
  }
  const isParticipant =
    tx.buyer_id === user.id || tx.listing_owner_id === user.id;
  if (!isParticipant) {
    return fail("You are not part of this transaction.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      transaction_id: parsed.data.transactionId,
      sender_id: user.id,
      content: SYSTEM_EVENT_TEXT[parsed.data.type],
      is_system_event: true,
      action_payload: {
        type: parsed.data.type,
        data: parsed.data.data,
      } as unknown as Json,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath(`/transactions/${parsed.data.transactionId}`);
  return ok({ id: data.id });
}
