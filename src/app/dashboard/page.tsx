import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { buttonVariants } from "@/components/ui/button";
import { UniversalImporterClient } from "@/modules/importer/components/universal-importer-client";

export const metadata: Metadata = { title: "Panel de control" };

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <GuestGate
          title="Tu panel de control"
          description="Desde aquí gestionas tus listados, favoritos, transacciones y más. Crea una cuenta para guardar tu progreso y volver a encontrarlo."
          next="/dashboard"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hola, {user.fullName || user.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            Rol: <span className="capitalize">{user.role.replace("_", " ")}</span>
          </p>
        </div>
        <Link href="/listings/new" className={buttonVariants()}>
          Publicar una propiedad
        </Link>
      </div>

      <div className="mt-8">
        <UniversalImporterClient />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Mis listados"
          description="Crea y administra tus propiedades con el asistente guiado."
          href="/my-listings"
        />
        <DashboardCard
          title="Favoritos"
          description="Clasifica propiedades en tu lista privada por niveles."
          href="/favorites"
        />
        <DashboardCard
          title="Transacciones"
          description="Da seguimiento a consultas, visitas, ofertas y depósito en garantía."
          href="/transactions"
        />
        <DashboardCard
          title="Importar con IA"
          description="Pega un enlace de Facebook, texto o nota de voz: la IA crea el listado y el flyer."
          href="/import"
        />
        <DashboardCard
          title="FSBO (Véndela tú mismo)"
          description="Carga tu propiedad en minutos, con valuación automática y agenda de WhatsApp 24/7."
          href="/fsbo"
        />
        <DashboardCard
          title="Red MLS"
          description="Red exclusiva de agentes con desglose transparente de comisiones."
          href="/mls"
        />
        <DashboardCard
          title="Preaprobación"
          description="Preaprobación de Infonavit y bancos con emparejamiento inteligente."
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
