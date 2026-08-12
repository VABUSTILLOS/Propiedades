import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getMyListings } from "@/modules/listings/queries";
import { ListingCard } from "@/modules/listings/components/listing-card";
import { buttonVariants } from "@/components/ui/button";

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
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis listados</h1>
          <p className="text-sm text-muted-foreground">
            {listings.length} {listings.length === 1 ? "listado" : "listados"}
          </p>
        </div>
        <Link href="/listings/new" className={buttonVariants()}>
          Nuevo listado
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no tienes ningún listado.
          </p>
          <Link
            href="/listings/new"
            className={buttonVariants({ className: "mt-4" })}
          >
            Crea tu primer listado
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
