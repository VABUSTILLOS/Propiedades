"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { bidCreateSchema, bidRespondSchema } from "@/modules/lib/schemas";
import type { BidStatus } from "@/modules/lib/database.types";
import { sendSystemEvent } from "@/modules/messaging/actions";

/**
 * Submit an offer on a property. The bid is created in "pending" status;
 * the owner responds via respondToBid.
 */
export async function createBid(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(bidCreateSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: propRows } = await supabase
    .from("properties")
    .select("owner_id, status")
    .eq("id", parsed.data.propertyId)
    .returns<{ owner_id: string; status: string }[]>()
    .limit(1);

  const listing = propRows?.[0];
  if (!listing || listing.status !== "active") {
    return fail("Property is not accepting offers.");
  }
  if (listing.owner_id === user.id) {
    return fail("You cannot bid on your own listing.");
  }

  const { data, error } = await supabase
    .from("bids")
    .insert({
      property_id: parsed.data.propertyId,
      transaction_id: parsed.data.transactionId ?? null,
      buyer_id: user.id,
      offered_price: parsed.data.offeredPrice,
      payment_method: parsed.data.paymentMethod,
      status: "pending",
      counter_offer_price: null,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  // Notify the thread with an offer_submitted card when the bid belongs
  // to a transaction (sendSystemEvent verifies the caller participates).
  if (parsed.data.transactionId) {
    await sendSystemEvent({
      transactionId: parsed.data.transactionId,
      type: "offer_submitted",
      data: {
        bid_id: data.id,
        offered_price: parsed.data.offeredPrice,
        payment_method: parsed.data.paymentMethod,
      },
    });
  }

  revalidatePath("/transactions");
  return ok({ id: data.id });
}

/**
 * Owner responds to a pending bid (accept, reject, or counter).
 */
export async function respondToBid(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(bidRespondSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: bidRows } = await supabase
    .from("bids")
    .select(
      "id, property_id, transaction_id, offered_price, payment_method, status, counter_offer_price",
    )
    .eq("id", parsed.data.bidId)
    .returns<
      {
        id: string;
        property_id: string;
        transaction_id: string | null;
        offered_price: number;
        payment_method: string;
        status: BidStatus;
        counter_offer_price: number | null;
      }[]
    >()
    .limit(1);

  const bid = bidRows?.[0];
  if (!bid) {
    return fail("Bid not found.");
  }
  if (bid.status !== "pending") {
    return fail("Only pending bids can be responded to.");
  }

  const { data: propRows } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", bid.property_id)
    .returns<{ owner_id: string }[]>()
    .limit(1);

  if (propRows?.[0]?.owner_id !== user.id) {
    return fail("Only the listing owner can respond.");
  }

  const nextStatus = parsed.data.status;
  if (nextStatus === "countered" && parsed.data.counterOfferPrice == null) {
    return fail("A counter-offer needs a price.");
  }

  const { error } = await supabase
    .from("bids")
    .update({
      status: nextStatus,
      counter_offer_price:
        parsed.data.counterOfferPrice ?? bid.counter_offer_price,
    })
    .eq("id", bid.id);

  if (error) {
    return fail(error.message);
  }

  // Reflect the owner's decision in the transaction thread. Accepted bids
  // render as an offer_accepted card; counters and rejections are plain
  // system lines (there is no dedicated card type for them).
  if (bid.transaction_id) {
    if (nextStatus === "accepted") {
      await sendSystemEvent({
        transactionId: bid.transaction_id,
        type: "offer_accepted",
        data: {
          bid_id: bid.id,
          offered_price: bid.offered_price,
          counter_offer_price:
            parsed.data.counterOfferPrice ?? bid.counter_offer_price,
        },
      });
    } else {
      const counterPrice =
        parsed.data.counterOfferPrice ?? bid.counter_offer_price ?? 0;
      await supabase.from("messages").insert({
        transaction_id: bid.transaction_id,
        sender_id: user.id,
        content:
          nextStatus === "countered"
            ? `Owner countered with $${counterPrice.toLocaleString()}.`
            : "Offer was declined.",
        is_system_event: true,
        action_payload: null,
      });
    }
  }

  revalidatePath("/transactions");
  return ok({ id: bid.id });
}
