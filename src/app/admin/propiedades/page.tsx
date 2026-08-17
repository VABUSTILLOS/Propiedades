import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { requireRole } from "@/modules/auth/session";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Em } from "@/components/layout/emphasis";
import { cn } from "@/lib/utils";
import {
  getAdminProperties,
  type AdminPropertyFilter,
} from "@/modules/admin/queries";
import { AdminPropertiesTable } from "@/modules/admin/components/admin-properties-table";

export const metadata: Metadata = { title: "Administrar propiedades" };

export const dynamic = "force-dynamic";

const TABS: { value: AdminPropertyFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "archived", label: "Archivadas" },
  { value: "deleted", label: "Borradas" },
];

const EMPTY_DESCRIPTIONS: Record<AdminPropertyFilter, string> = {
  all: "No hay propiedades para moderar.",
  archived: "No hay propiedades archivadas.",
  deleted: "No hay propiedades borradas.",
};

function parseFilter(raw: string | string[] | undefined): AdminPropertyFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "archivadas") return "archived";
  if (value === "borradas") return "deleted";
  return "all";
}

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["admin"]);

  const params = await searchParams;
  const filter = parseFilter(params.estado);
  const properties = await getAdminProperties(filter);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Master"
        icon={ShieldCheck}
        title={
          <>
            Administrar <Em>propiedades</Em>
          </>
        }
        description="Selecciona propiedades para archivarlas, borrarlas o restaurarlas."
      />

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filtros de estado">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value === "all"
                ? "/admin/propiedades"
                : `/admin/propiedades?estado=${tab.value === "archived" ? "archivadas" : "borradas"}`
            }
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
              filter === tab.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {properties.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            description={EMPTY_DESCRIPTIONS[filter]}
          />
        ) : (
          <AdminPropertiesTable properties={properties} filter={filter} />
        )}
      </div>
    </PageShell>
  );
}
