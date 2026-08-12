import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getTransactionById } from "@/modules/transactions/queries";
import { getListingById } from "@/modules/listings/queries";
import { getTransactionMessages } from "@/modules/messaging/queries";
import { getPropertySlots } from "@/modules/bookings/queries";
import { getPropertyBids } from "@/modules/bids/queries";
import { TRANSACTION_LABELS } from "@/modules/transactions/state-machine";
import { TransactionActions } from "@/modules/transactions/components/transaction-actions";
import { MessageThread } from "@/modules/messaging/components/message-thread";
import { TourSlots } from "@/modules/bookings/components/tour-slots";
import { BidsPanel } from "@/modules/bids/components/bids-panel";
import { ReviewForm } from "@/modules/reviews/components/review-form";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = { title: "Transaction" };

export default async function TransactionDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <GuestGate
          title="Detalle de transacción"
          description="Mensajes, agenda de visitas, ofertas y reseñas de cada transacción. Inicia sesión para ver los detalles."
          next="/transactions"
        />
      </div>
    );
  }

  const transaction = await getTransactionById(id, user.id);
  if (!transaction) notFound();

  const [property, messages, slots, bids] = await Promise.all([
    getListingById(transaction.property_id),
    getTransactionMessages(id),
    getPropertySlots(transaction.property_id),
    getPropertyBids(transaction.property_id),
  ]);

  const otherPartyId =
    transaction.buyer_id === user.id
      ? transaction.listing_owner_id
      : transaction.buyer_id;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Transaction details
          </h1>
          <Badge>{TRANSACTION_LABELS[transaction.state]}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Started {new Date(transaction.created_at).toLocaleDateString()}
        </p>
        {property && (
          <Link
            href={`/property/${property.slug}`}
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            View listing
          </Link>
        )}
      </div>

      <TransactionActions
        transactionId={transaction.id}
        currentState={transaction.state}
      />

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Messages
          </h2>
          <MessageThread
            transactionId={transaction.id}
            currentUserId={user.id}
            initialMessages={messages}
            viewerIsOwner={transaction.listing_owner_id === user.id}
          />
        </section>

        {property && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tour scheduling
            </h2>
            <TourSlots
              propertyId={property.id}
              ownerId={property.owner_id}
              currentUserId={user.id}
              transactionId={transaction.id}
              slots={slots}
            />
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Offers
          </h2>
          <BidsPanel
            propertyId={transaction.property_id}
            transactionId={transaction.id}
            propertyOwnerId={transaction.listing_owner_id}
            currentUserId={user.id}
            bids={bids}
          />
        </section>

        {transaction.state === "closed" && otherPartyId && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Review
            </h2>
            <ReviewForm
              transactionId={transaction.id}
              subjectId={otherPartyId}
            />
          </section>
        )}
      </div>
    </div>
  );
}
