import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Propiedades
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/search"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Search
          </Link>
          {user ? (
            <Link href="/dashboard" className={buttonVariants()}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
                Sign in
              </Link>
              <Link href="/sign-up" className={buttonVariants()}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Find your next property in Mexico.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          A two-sided marketplace connecting buyers, investors, agents and
          owners — with tours, messaging, bids and trusted reviews built in.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/search" className={buttonVariants({ size: "lg" })}>
            Browse listings
          </Link>
          <Link
            href="/sign-up"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            List your property
          </Link>
        </div>
      </section>
    </main>
  );
}
