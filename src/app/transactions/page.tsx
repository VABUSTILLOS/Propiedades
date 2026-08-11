import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/modules/auth/session";
import { getMyTransactions } from "@/modules/transactions/queries";
import { TRANSACTION_LABELS } from "@/modules/transactions/state-machine";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const user = await requireUser();
  const transactions = await getMyTransactions(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inquiries, tours, offers and escrow — all in one place.
        </p>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            You have no transactions yet. Inquire on a property to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const isBuyer = tx.buyer_id === user.id;
            return (
              <Link key={tx.id} href={`/transactions/${tx.id}`} className="block">
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {isBuyer ? "Your inquiry" : "Inbound inquiry"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Started {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        tx.state === "closed" || tx.state === "canceled"
                          ? "secondary"
                          : "default"
                      }
                    >
                      {TRANSACTION_LABELS[tx.state]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
