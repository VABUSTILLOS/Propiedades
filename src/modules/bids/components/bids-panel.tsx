"use client";

import { useState, useTransition } from "react";

import { createBid, respondToBid } from "@/modules/bids/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BidsRow } from "@/modules/lib/database.types";

const BID_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  countered: "Contraofertada",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  infonavit: "Infonavit",
  fonacot: "Fonacot",
  bank_loan: "Crédito bancario",
  mixed: "Mixto",
};

type Props = {
  propertyId: string;
  transactionId: string;
  propertyOwnerId: string;
  currentUserId: string;
  bids: BidsRow[];
};

export function BidsPanel({
  propertyId,
  transactionId,
  propertyOwnerId,
  currentUserId,
  bids,
}: Props) {
  const isOwner = propertyOwnerId === currentUserId;
  const [price, setPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [counterPrice, setCounterPrice] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submitBid = () =>
    startTransition(async () => {
      setError(null);
      const res = await createBid({
        propertyId,
        transactionId,
        offeredPrice: Number(price),
        paymentMethod,
      });
      if (!res.ok) setError(res.error);
      else setPrice("");
    });

  const respond = (bidId: string, status: "accepted" | "rejected" | "countered") =>
    startTransition(async () => {
      setError(null);
      const res = await respondToBid({
        bidId,
        status,
        counterOfferPrice:
          status === "countered" && counterPrice[bidId]
            ? Number(counterPrice[bidId])
            : null,
      });
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Ofertas</h3>

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {bids.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Aún no hay ofertas en esta propiedad.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {bids.map((bid) => (
            <li
              key={bid.id}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  ${bid.offered_price.toLocaleString()}
                  {bid.counter_offer_price != null && (
                    <span className="text-muted-foreground">
                      {" "}
                      (contraoferta ${bid.counter_offer_price.toLocaleString()})
                    </span>
                  )}
                </span>
                <Badge variant="outline">
                  {BID_STATUS_LABELS[bid.status] ?? bid.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {PAYMENT_LABELS[bid.payment_method] ?? bid.payment_method} ·{" "}
                {bid.buyer_id === currentUserId ? "tú" : "comprador"}
              </p>

              {isOwner && bid.status === "pending" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    placeholder="Precio de contraoferta"
                    value={counterPrice[bid.id] ?? ""}
                    onChange={(e) =>
                      setCounterPrice((prev) => ({
                        ...prev,
                        [bid.id]: e.target.value,
                      }))
                    }
                    className="w-32 rounded-md border bg-background px-2 py-1 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => respond(bid.id, "countered")}
                  >
                    Contraofertar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => respond(bid.id, "accepted")}
                  >
                    Aceptar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => respond(bid.id, "rejected")}
                  >
                    Rechazar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isOwner && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            Precio de la oferta (MXN)
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="block w-40 rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Método de pago
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="block rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            >
              <option value="cash">Efectivo</option>
              <option value="infonavit">Infonavit</option>
              <option value="fonacot">Fonacot</option>
              <option value="bank_loan">Crédito bancario</option>
              <option value="mixed">Mixto</option>
            </select>
          </label>
          <Button
            size="sm"
            disabled={isPending || !price}
            onClick={submitBid}
          >
            Enviar oferta
          </Button>
        </div>
      )}
    </div>
  );
}
