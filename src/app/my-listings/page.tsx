import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getMyListings } from "@/modules/listings/queries";
import { MyListingsGrid } from "@/modules/listings/components/my-listings-grid";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { EmptyState } from "@/components/layout/empty-state";
import { Store } from "lucide-react";

export const metadata: Metadata = { title: "Mis listados" };

export default async function MyListingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <GuestGate
          title="Tus listados en un solo lugar"
          description="Crea, edita y publica propiedades con el asistente guiado. Crea una cuenta para guardar y administrar tus listados."
          next="/my-listings"
        />
      </div>
    );
  }

  const listings = await getMyListings(user.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vender"
        icon={Store}
        title={<>Mis <Em>listados</Em></>}
        description={`${listings.length} ${listings.length === 1 ? "listado" : "listados"}`}
        actions={
          <Link href="/listings/new" className={buttonVariants()}>
            Nuevo listado
          </Link>
        }
      />

      {listings.length === 0 ? (
        <EmptyState
          icon={Store}
          className="mt-12"
          description="Aún no tienes ningún listado."
          action={
            <Link href="/listings/new" className={buttonVariants()}>
              Crea tu primer listado
            </Link>
          }
        />
      ) : (
        <MyListingsGrid listings={listings} />
      )}
    </PageShell>
  );
}
