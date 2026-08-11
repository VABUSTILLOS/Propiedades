import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/modules/auth/session";
import { buttonVariants } from "@/components/ui/button";
import { UniversalImporterClient } from "@/modules/importer/components/universal-importer-client";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {user.fullName || user.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            Role: <span className="capitalize">{user.role.replace("_", " ")}</span>
          </p>
        </div>
        <Link href="/listings/new" className={buttonVariants()}>
          List a property
        </Link>
      </div>

      <div className="mt-8">
        <UniversalImporterClient />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="My listings"
          description="Create and manage your property listings with the guided wizard."
          href="/my-listings"
        />
        <DashboardCard
          title="Favorites"
          description="Rank properties in your private tier list."
          href="/favorites"
        />
        <DashboardCard
          title="Transactions"
          description="Track inquiries, tours, offers and escrow."
          href="/transactions"
        />
        <DashboardCard
          title="Import with AI"
          description="Paste a Facebook URL, text or voice note — AI creates the listing + flyer."
          href="/import"
        />
        <DashboardCard
          title="FSBO (Sell it yourself)"
          description="Quick-load your property, auto-AVM, and open 24/7 WhatsApp booking."
          href="/fsbo"
        />
        <DashboardCard
          title="MLS network"
          description="Agent-only network with transparent commission splits."
          href="/mls"
        />
        <DashboardCard
          title="Preapproval"
          description="Infonavit & bank pre-approval with smart matching."
          href="/preapproval"
        />
        <DashboardCard
          title="Planificar rutas"
          description="Armar el itinerario óptimo de visitas del fin de semana."
          href="/plan-tour"
        />
        <DashboardCard
          title="Comparador"
          description="Compara hasta 4 inmuebles lado a lado por $/m²."
          href="/compare"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border bg-card p-6 shadow-sm transition-colors hover:border-primary"
    >
      <h2 className="font-semibold group-hover:text-primary">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
