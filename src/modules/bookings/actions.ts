"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { slotBookSchema, slotCreateSchema } from "@/modules/lib/schemas";
import { sendSystemEvent } from "@/modules/messaging/actions";

/**
 * Create an availability slot for a property the caller owns.
 * No overlap with existing slots is allowed.
 */
export async function createSlot(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(slotCreateSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: propRows } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", parsed.data.propertyId)
    .returns<{ owner_id: string }[]>()
    .limit(1);

  if (propRows?.[0]?.owner_id !== user.id) {
    return fail("No eres dueño de esta propiedad.");
  }

  const start = new Date(parsed.data.startTime);
  const end = new Date(parsed.data.endTime);
  if (start >= end) {
    return fail("Slot end must be after its start.");
  }

  // Conflict check: any overlapping slot on the same property blocks creation.
  const { data: overlapping } = await supabase
    .from("availability_slots")
    .select("id")
    .eq("property_id", parsed.data.propertyId)
    .lt("start_time", parsed.data.endTime)
    .gte("end_time", parsed.data.startTime)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return fail("Slot overlaps an existing availability window.");
  }

  const { data, error } = await supabase
    .from("availability_slots")
    .insert({
      property_id: parsed.data.propertyId,
      agent_or_owner_id: user.id,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      is_booked: false,
      booked_by_user_id: null,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath(`/property/${parsed.data.propertyId}`);
  return ok({ id: data.id });
}

/**
 * Book a tour slot. The booking user must not be the slot owner, the slot
 * must be free, and the transition also advances the transaction state
 * when a tour_pending transaction exists.
 */
export async function bookSlot(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(slotBookSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: slotRows } = await supabase
    .from("availability_slots")
    .select(
      "id, property_id, agent_or_owner_id, is_booked, start_time, end_time",
    )
    .eq("id", parsed.data.slotId)
    .returns<
      {
        id: string;
        property_id: string;
        agent_or_owner_id: string;
        is_booked: boolean | null;
        start_time: string;
        end_time: string;
      }[]
    >()
    .limit(1);

  const slot = slotRows?.[0];
  if (!slot) {
    return fail("Slot not found.");
  }
  if (slot.agent_or_owner_id === user.id) {
    return fail("No puedes reservar tu propio espacio.");
  }
  if (slot.is_booked) {
    return fail("This slot is already booked.");
  }

  // Atomic claim: update guarded by is_booked=false predicate.
  const { error } = await supabase
    .from("availability_slots")
    .update({ is_booked: true, booked_by_user_id: user.id })
    .eq("id", slot.id)
    .eq("is_booked", false);

  if (error) {
    return fail(error.message);
  }

  // Emit a tour_request card into the linked transaction thread so the
  // owner sees and can confirm the booking. sendSystemEvent checks that
  // the caller is a participant of that transaction.
  if (parsed.data.transactionId) {
    await sendSystemEvent({
      transactionId: parsed.data.transactionId,
      type: "tour_request",
      data: {
        slot_id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
      },
    });
  }

  revalidatePath(`/property/${slot.property_id}`);
  revalidatePath("/transactions");
  return ok({ id: slot.id });
}
