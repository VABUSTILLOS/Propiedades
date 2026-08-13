import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Gavel, Home, MessageCircle } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";

import { getCurrentUser } from "@/modules/auth/session";
import { getProfileByUserId } from "@/modules/profiles/queries";
import { getSearchableCities } from "@/modules/search/queries";
import { getMyListings } from "@/modules/listings/queries";
import { FsboWizard } from "@/modules/fsbo/components/fsbo-wizard";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Módulo FSBO" };

export const dynamic = "force-dynamic";

export default async function FsboPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  const [cities, listings] = await Promise.all([
    getSearchableCities(),
    user ? getMyListings(user.id) : Promise.resolve([]),
  ]);
  const waNumber = profile?.phone?.replace(/\D/g, "") ?? "";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vender"
        icon={Home}
        title="Módulo FSBO (Dueño)"
        description="Publica tu propiedad en minutos, con valuación automática y ofertas digitales 24/7."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-4 text-lg font-semibold">Carga rápida</h2>
          <FsboWizard cities={cities} />
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <MessageCircle className="size-4 text-emerald-600" />
              Agenda 24/7
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Los interesados agendan visitas por WhatsApp en cualquier momento.
            </p>
            <a
              href={`https://wa.me/52${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ className: "mt-3 w-full" })}
            >
              Abrir WhatsApp
            </a>
            <a
              href="https://calendar.google.com/calendar/r"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({
                variant: "outline",
                className: "mt-2 w-full",
              })}
            >
              <CalendarClock className="mr-2 size-4" />
              Calendario
            </a>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <Gavel className="size-4" />
              Bidding Hub
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Recibe ofertas digitales con método de pago y contraofertas.
            </p>
            {listings.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {listings.slice(0, 5).map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/property/${l.slug}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {l.title} · ${l.price.toLocaleString()}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Publica tu primera propiedad para abrir el hub de ofertas.
              </p>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
