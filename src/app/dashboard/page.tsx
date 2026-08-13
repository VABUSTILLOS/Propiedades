import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  GitCompareArrows,
  Handshake,
  Heart,
  Landmark,
  Newspaper,
  Sparkles,
  Store,
} from "lucide-react";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { ToolCard } from "@/components/layout/tool-card";
import { UniversalImporterClient } from "@/modules/importer/components/universal-importer-client";

export const metadata: Metadata = { title: "Panel de control" };

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <PageShell>
        <GuestGate
          title="Tu panel de control"
          description="Desde aquí gestionas tus listados, favoritos, transacciones y más. Crea una cuenta para guardar tu progreso y volver a encontrarlo."
          next="/dashboard"
        />
      </PageShell>
    );
  }

  return (
    <div className="flex-1">
      {/* Branded greeting band */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-secondary/80 via-background to-background">
        <div className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-chart-2/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-6 py-12 sm:flex-row sm:items-center">
          <div>
            <span className="mb-3 inline-flex items-center rounded-full border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
              Panel de control
            </span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Hola, {user.fullName || user.email}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Rol:{" "}
              <span className="font-medium capitalize">
                {user.role.replace("_", " ")}
              </span>{" "}
              · Todo tu negocio inmobiliario en un solo lugar.
            </p>
          </div>
          <Link href="/listings/new" className={buttonVariants()}>
            Publicar una propiedad
          </Link>
        </div>
      </section>

      <PageShell>
        <UniversalImporterClient />

        <ToolGroup title="Vender">
          <ToolCard
            title="Mis listados"
            description="Crea y administra tus propiedades con el asistente guiado."
            href="/my-listings"
            icon={Store}
          />
          <ToolCard
            title="Importar con IA"
            description="Pega un enlace de Facebook, texto o nota de voz: la IA crea el listado y el flyer."
            href="/import"
            icon={Sparkles}
          />
          <ToolCard
            title="FSBO (Véndela tú mismo)"
            description="Carga tu propiedad en minutos, con valuación automática y agenda de WhatsApp 24/7."
            href="/fsbo"
            icon={CalendarClock}
          />
          <ToolCard
            title="Red MLS"
            description="Red exclusiva de agentes con desglose transparente de comisiones."
            href="/mls"
            icon={Building2}
          />
          <ToolCard
            title="Mis flyers"
            description="Páginas compartibles con métricas de visitas y captación de leads."
            href="/my-flyers"
            icon={Newspaper}
          />
        </ToolGroup>

        <ToolGroup title="Comprar">
          <ToolCard
            title="Favoritos"
            description="Clasifica propiedades en tu lista privada por niveles."
            href="/favorites"
            icon={Heart}
          />
          <ToolCard
            title="Comparador"
            description="Compara hasta 4 inmuebles lado a lado por $/m²."
            href="/compare"
            icon={GitCompareArrows}
          />
          <ToolCard
            title="Planificar rutas"
            description="Arma el itinerario óptimo de visitas del fin de semana."
            href="/plan-tour"
            icon={CalendarClock}
          />
        </ToolGroup>

        <ToolGroup title="Seguimiento">
          <ToolCard
            title="Transacciones"
            description="Da seguimiento a consultas, visitas, ofertas y depósito en garantía."
            href="/transactions"
            icon={Handshake}
          />
          <ToolCard
            title="Preaprobación"
            description="Preaprobación de Infonavit y bancos con emparejamiento inteligente."
            href="/preapproval"
            icon={Landmark}
          />
        </ToolGroup>
      </PageShell>
    </div>
  );
}

function ToolGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
