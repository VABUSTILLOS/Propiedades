"use client";

import { useState, useTransition } from "react";

import { transitionTransaction } from "@/modules/transactions/actions";
import { TRANSACTION_LABELS, ALLOWED_TRANSITIONS } from "@/modules/transactions/state-machine";
import { Button } from "@/components/ui/button";
import type { TransactionState } from "@/modules/lib/database.types";

/**
 * Forward actions for the state machine, keyed by current state.
 * Each button drives a transitionTransaction call.
 */
const FORWARD_ACTIONS: Record<TransactionState, { to: TransactionState; label: string }[]> = {
  inquired: [
    { to: "tour_pending", label: "Solicitar visita" },
    { to: "offer_pending", label: "Hacer oferta" },
  ],
  tour_pending: [{ to: "tour_confirmed", label: "Confirmar visita" }],
  tour_confirmed: [{ to: "offer_pending", label: "Hacer oferta" }],
  offer_pending: [{ to: "offer_accepted", label: "Aceptar oferta" }],
  offer_accepted: [{ to: "in_escrow", label: "Iniciar depósito en garantía" }],
  in_escrow: [{ to: "closed", label: "Cerrar trato" }],
  closed: [],
  canceled: [],
};

type Props = {
  transactionId: string;
  currentState: TransactionState;
};

export function TransactionActions({ transactionId, currentState }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (toState: TransactionState) =>
    startTransition(async () => {
      setError(null);
      const res = await transitionTransaction({ transactionId, toState });
      if (!res.ok) setError(res.error);
    });

  const forward = FORWARD_ACTIONS[currentState] ?? [];
  const canCancel =
    currentState !== "closed" &&
    currentState !== "canceled" &&
    ALLOWED_TRANSITIONS[currentState]?.includes("canceled");

  return (
    <div>
      {error && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {forward.map((action) => (
          <Button
            key={action.to}
            size="sm"
            disabled={isPending}
            onClick={() => act(action.to)}
          >
            {action.label}
          </Button>
        ))}

        {canCancel && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => act("canceled")}
          >
            Cancelar transacción
          </Button>
        )}

        {forward.length === 0 && !canCancel && (
          <p className="text-sm text-muted-foreground">
            La transacción está {TRANSACTION_LABELS[currentState].toLowerCase()} —
            no hay más acciones.
          </p>
        )}
      </div>
    </div>
  );
}
