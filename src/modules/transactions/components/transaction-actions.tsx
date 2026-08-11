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
    { to: "tour_pending", label: "Request tour" },
    { to: "offer_pending", label: "Make offer" },
  ],
  tour_pending: [{ to: "tour_confirmed", label: "Confirm tour" }],
  tour_confirmed: [{ to: "offer_pending", label: "Make offer" }],
  offer_pending: [{ to: "offer_accepted", label: "Accept offer" }],
  offer_accepted: [{ to: "in_escrow", label: "Start escrow" }],
  in_escrow: [{ to: "closed", label: "Close deal" }],
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
            Cancel transaction
          </Button>
        )}

        {forward.length === 0 && !canCancel && (
          <p className="text-sm text-muted-foreground">
            Transaction is {TRANSACTION_LABELS[currentState].toLowerCase()} — no
            further actions.
          </p>
        )}
      </div>
    </div>
  );
}
