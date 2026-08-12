"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { reviewCreateSchema } from "@/modules/lib/schemas";

/**
 * Submit a double-blind review for a completed transaction.
 * The other participant is the subject; both parties can review, and the
 * UNIQUE(transaction_id, author_id) constraint prevents duplicates.
 */
export async function createReview(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(reviewCreateSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: txRows } = await supabase
    .from("transactions")
    .select("id, buyer_id, listing_owner_id, state")
    .eq("id", parsed.data.transactionId)
    .returns<
      {
        id: string;
        buyer_id: string;
        listing_owner_id: string;
        state: string;
      }[]
    >()
    .limit(1);

  const tx = txRows?.[0];
  if (!tx) {
    return fail("Transacción no encontrada.");
  }

  const isParticipant =
    tx.buyer_id === user.id || tx.listing_owner_id === user.id;
  if (!isParticipant) {
    return fail("No formas parte de esta transacción.");
  }

  if (tx.state !== "closed") {
    return fail("Las reseñas solo se permiten después de cerrar la transacción.");
  }

  if (parsed.data.subjectId !== tx.buyer_id && parsed.data.subjectId !== tx.listing_owner_id) {
    return fail("El sujeto de la reseña debe ser el otro participante.");
  }
  if (parsed.data.subjectId === user.id) {
    return fail("No puedes reseñarte a ti mismo.");
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      transaction_id: parsed.data.transactionId,
      author_id: user.id,
      subject_id: parsed.data.subjectId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath(`/transactions/${parsed.data.transactionId}`);
  return ok({ id: data.id });
}
