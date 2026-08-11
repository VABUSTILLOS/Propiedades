import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/modules/auth/session";
import { getMyListings } from "@/modules/listings/queries";
import { ListingCard } from "@/modules/listings/components/listing-card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "My listings" };

export default async function MyListingsPage() {
  const user = await requireUser();
  const listings = await getMyListings(user.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My listings</h1>
          <p className="text-sm text-muted-foreground">
            {listings.length} listing{listings.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/listings/new" className={buttonVariants()}>
          New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any listings yet.
          </p>
          <Link
            href="/listings/new"
            className={buttonVariants({ className: "mt-4" })}
          >
            Create your first listing
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
