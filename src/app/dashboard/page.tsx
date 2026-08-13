import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  GitCompareArrows,
  Handshake,
  Heart,
  KeyRound,
  Landmark,
  MapPinned,
  Newspaper,
  Settings,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { PageShell } from "@/components/layout/page-shell";
import { Em } from "@/components/layout/emphasis";
import { ToolCard } from "@/components/layout/tool-card";
import { FolioLabel } from "@/modules/home/components/folio-label";
import { UniversalImporterClient } from "@/modules/importer/components/universal-importer-client";
import { getDashboardStats } from "@/modules/dashboard/queries";

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

  const stats = await getDashboardStats(user.id);
  const firstName = user.fullName.split(" ")[0] || user.email;

  return (
    <div className="flex-1">
      {/* Banda de saludo en tinta oscura — mismo lenguaje que el registro */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(251,246,240,0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-12">
          <FolioLabel index="01" title="Panel de control" light />

          <div className="mt-3 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Hola, <Em>{firstName}</Em>
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Rol:{" "}
                <span className="font-medium capitalize text-white/85">
                  {user.role.replace("_", " ")}
                </span>{" "}
                · Todo tu negocio inmobiliario en un solo lugar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/listings/new"
                className="inline-flex h-10 items-center rounded-full bg-ink-foreground px-5 text-sm font-semibold text-ink transition-colors hover:bg-white"
              >
                Publicar una propiedad
              </Link>
              <Link
                href="/search"
                className="inline-flex h-10 items-center rounded-full border border-white/25 px-5 text-sm font-medium text-ink-foreground transition-colors hover:border-white/50 hover:bg-white/5"
              >
                Ver oportunidades
              </Link>
            </div>
          </div>

          {/* Tira de métricas estilo ledger: celdas hairline, números mono */}
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            <Stat value={stats.activeListings} label="Listados activos" />
            <Stat value={stats.favorites} label="Favoritos guardados" />
            <Stat value={stats.activeTransactions} label="Transacciones activas" />
            <Stat value={stats.flyerViews} label="Visitas a tus flyers" />
          </dl>
        </div>
      </section>

      <PageShell>
        <UniversalImporterClient />

        <ToolGroup index="02" title="Vender">
          <ToolCard
            index="01"
            title="Mis listados"
            description="Crea y administra tus propiedades con el asistente guiado."
            href="/my-listings"
            icon={Store}
          />
          <ToolCard
            index="02"
            title="Importar con IA"
            description="Pega un enlace de Facebook, texto o nota de voz: la IA crea el listado y el flyer."
            href="/import"
            icon={Sparkles}
          />
          <ToolCard
            index="03"
            title="FSBO (Véndela tú mismo)"
            description="Carga tu propiedad en minutos, con valuación automática y agenda de WhatsApp 24/7."
            href="/fsbo"
            icon={CalendarClock}
          />
          <ToolCard
            index="04"
            title="Red MLS"
            description="Red exclusiva de agentes con desglose transparente de comisiones."
            href="/mls"
            icon={Building2}
          />
          <ToolCard
            index="05"
            title="Mis flyers"
            description="Páginas compartibles con métricas de visitas y captación de leads."
            href="/my-flyers"
            icon={Newspaper}
          />
          <ToolCard
            index="06"
            title="Mi agencia"
            description="Panel de tu agencia: agentes, branding y subdominio propio."
            href="/agencia"
            icon={Users}
          />
        </ToolGroup>

        <ToolGroup index="03" title="Comprar e invertir">
          <ToolCard
            index="01"
            title="Favoritos"
            description="Clasifica propiedades en tu lista privada por niveles."
            href="/favorites"
            icon={Heart}
          />
          <ToolCard
            index="02"
            title="Comparador"
            description="Compara hasta 4 inmuebles lado a lado por $/m²."
            href="/compare"
            icon={GitCompareArrows}
          />
          <ToolCard
            index="03"
            title="Planificar rutas"
            description="Arma el itinerario óptimo de visitas del fin de semana."
            href="/plan-tour"
            icon={MapPinned}
          />
          <ToolCard
            index="04"
            title="Oportunidades de inversión"
            description="Remates, flipping y descuentos vs. colonia en un solo tablero."
            href="/search"
            icon={TrendingUp}
          />
          <ToolCard
            index="05"
            title="Rentas"
            description="Las mejores oportunidades de renta del mercado, filtradas para ti."
            href="/rentas"
            icon={KeyRound}
          />
        </ToolGroup>

        <ToolGroup index="04" title="Seguimiento">
          <ToolCard
            index="01"
            title="Transacciones"
            description="Da seguimiento a consultas, visitas, ofertas y depósito en garantía."
            href="/transactions"
            icon={Handshake}
          />
          <ToolCard
            index="02"
            title="Preaprobación"
            description="Preaprobación de Infonavit y bancos con emparejamiento inteligente."
            href="/preapproval"
            icon={Landmark}
          />
          <ToolCard
            index="03"
            title="Configuración"
            description="Datos de tu cuenta, notificaciones y preferencias."
            href="/settings"
            icon={Settings}
          />
        </ToolGroup>
      </PageShell>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-ink p-4 sm:p-5">
      <dd className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
        {value.toLocaleString("es-MX")}
      </dd>
      <dt className="mt-1 font-mono text-xs font-medium uppercase tracking-[0.2em] text-white/70">
        {label}
      </dt>
    </div>
  );
}

function ToolGroup({
  index,
  title,
  children,
}: {
  /** Zero-padded folio number, e.g. "02". */
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <FolioLabel index={index} title={title} className="mb-4" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
