import type { TransactionState } from "@/modules/lib/database.types";

/**
 * Explicit transaction state machine. Every UI action and Server Action
 * transition is validated against this table; the DB stays the source of
 * truth via RLS + an UPDATE guard.
 */
export const TRANSACTION_FLOW: TransactionState[] = [
  "inquired",
  "tour_pending",
  "tour_confirmed",
  "offer_pending",
  "offer_accepted",
  "in_escrow",
  "closed",
];

// Mirrors the graph enforced by public.validate_transaction_transition()
// in supabase/migrations/003_computational_logic.sql (the source of truth).
// No reverts; terminal states (closed / canceled) cannot transition.
export const ALLOWED_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  inquired: ["tour_pending", "offer_pending", "canceled"],
  tour_pending: ["tour_confirmed", "canceled"],
  tour_confirmed: ["offer_pending", "closed", "canceled"],
  offer_pending: ["offer_accepted", "canceled"],
  offer_accepted: ["in_escrow", "closed", "canceled"],
  in_escrow: ["closed", "canceled"],
  closed: [],
  canceled: [],
};

/** Terminal states cannot transition further. */
export function canTransition(
  from: TransactionState,
  to: TransactionState,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export const TRANSACTION_LABELS: Record<TransactionState, string> = {
  inquired: "Consultado",
  tour_pending: "Visita pendiente",
  tour_confirmed: "Visita confirmada",
  offer_pending: "Oferta pendiente",
  offer_accepted: "Oferta aceptada",
  in_escrow: "En depósito en garantía",
  closed: "Cerrada",
  canceled: "Cancelada",
};

/**
 * Human actions that drive the state machine, mapped to target states.
 * Rendered as inline action cards in the messaging thread.
 */
export const ACTION_MAPPINGS: Record<
  "accept_tour" | "request_tour" | "make_offer" | "accept_offer" | "start_escrow" | "close_deal",
  TransactionState
> = {
  accept_tour: "tour_confirmed",
  request_tour: "tour_pending",
  make_offer: "offer_pending",
  accept_offer: "offer_accepted",
  start_escrow: "in_escrow",
  close_deal: "closed",
};
