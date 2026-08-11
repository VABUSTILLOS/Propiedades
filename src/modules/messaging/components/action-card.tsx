"use client";

import { useState, useTransition } from "react";

import { respondToBid } from "@/modules/bids/actions";
import { transitionTransaction } from "@/modules/transactions/actions";
import { TRANSACTION_LABELS } from "@/modules/transactions/state-machine";
import { messageActionCardSchema } from "@/modules/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MessagesRow } from "@/modules/lib/database.types";

type Props = {
  message: MessagesRow;
  transactionId: string;
  /** Whether the viewer is the listing owner (owns actionable buttons). */
  viewerIsOwner: boolean;
};

const CARD_TITLES: Record<string, string> = {
  tour_request: "Tour request",
  tour_accepted: "Tour confirmed",
  offer_submitted: "Offer submitted",
  offer_accepted: "Offer accepted",
  escrow_started: "Escrow started",
  deal_closed: "Deal closed",
  canceled: "Transaction canceled",
  status_change: "Status changed",
};

const mxn = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    value,
  );

/**
 * Interactive card for a message with a structured `action_payload`.
 * Parses strictly via `messageActionCardSchema`; returns null when the
 * payload doesn't match its declared type (thread falls back to text).
 */
export function ActionCard({ message, transactionId, viewerIsOwner }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!message.action_payload) return null;
  const parsed = messageActionCardSchema.safeParse(message.action_payload);
  if (!parsed.success) return null;

  const { type, data } = parsed.data;

  const act = (run: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await run();
      if (!res.ok) setError(res.error ?? "Action failed.");
    });

  const acceptTour =
    type === "tour_request"
      ? () =>
          act(() =>
            transitionTransaction({ transactionId, toState: "tour_confirmed" }),
          )
      : null;

  const offer = type === "offer_submitted" ? data : null;
  const acceptOffer = offer?.bid_id
    ? () =>
        act(async () => {
          const bid = await respondToBid({
            bidId: offer.bid_id,
            status: "accepted",
          });
          if (!bid.ok) return bid;
          return transitionTransaction({
            transactionId,
            toState: "offer_accepted",
          });
        })
    : null;
  const rejectOffer = offer?.bid_id
    ? () =>
        act(() =>
          respondToBid({ bidId: offer.bid_id, status: "rejected" }),
        )
    : null;

  const statusChange = type === "status_change" ? data : null;
  const tour = type === "tour_request" ? data : null;
  const offerInfo = type === "offer_accepted" ? data : null;

  const displayedPrice = offer?.offered_price ?? offerInfo?.offered_price;

  return (
    <Card className="w-full max-w-md border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {CARD_TITLES[type] ?? "Action"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {statusChange && (
          <p className="text-muted-foreground">
            {TRANSACTION_LABELS[statusChange.from]} →{" "}
            {TRANSACTION_LABELS[statusChange.to]}
          </p>
        )}
        {tour && (
          <p className="text-muted-foreground">
            {tour.start_time
              ? new Date(tour.start_time).toLocaleString("es-MX")
              : "A tour was requested."}
          </p>
        )}
        {(offer || offerInfo) && (
          <div className="space-y-1 text-muted-foreground">
            {displayedPrice != null && <p>Offered price: {mxn(displayedPrice)}</p>}
            {offerInfo?.counter_offer_price != null && (
              <p>Counter-offer: {mxn(offerInfo.counter_offer_price)}</p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {viewerIsOwner && (acceptTour || acceptOffer) && (
          <div className="flex gap-2 pt-1">
            {acceptTour && (
              <Button size="sm" disabled={isPending} onClick={() => acceptTour()}>
                Accept tour
              </Button>
            )}
            {acceptOffer && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => acceptOffer()}
              >
                Accept offer
              </Button>
            )}
            {rejectOffer && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => rejectOffer()}
              >
                Reject
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
