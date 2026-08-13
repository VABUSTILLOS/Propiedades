import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getMyTransactions } from "@/modules/transactions/queries";
import { TRANSACTION_LABELS } from "@/modules/transactions/state-machine";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Handshake } from "lucide-react";

export const metadata: Metadata = { title: "Transacciones" };

export default async function TransactionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <GuestGate
          title="Da seguimiento a tus transacciones"
          description="Visitas, ofertas, mensajes y cierre — todo en un solo lugar. Crea una cuenta para iniciar y dar seguimiento a tus transacciones."
          next="/transactions"
        />
      </div>
    );
  }

  const transactions = await getMyTransactions(user.id);

  return (
    <PageShell size="md">
      <PageHeader
        eyebrow="Seguimiento"
        icon={Handshake}
        title="Transacciones"
        description="Consultas, visitas, ofertas y depósito en garantía — todo en un solo lugar."
        className="mb-8"
      />

      {transactions.length === 0 ? (
        <EmptyState
          icon={Handshake}
          description="Aún no tienes transacciones. Pregunta por una propiedad para empezar."
        />
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
                        {isBuyer ? "Tu consulta" : "Consulta entrante"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Iniciada {new Date(tx.created_at).toLocaleDateString()}
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
    </PageShell>
  );
}
