import type { Metadata } from "next";
import Link from "next/link";
import { GitCompareArrows, Trophy } from "lucide-react";

import { getListingsByIds } from "@/modules/listings/queries";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export const metadata: Metadata = { title: "Comparador" };

export const dynamic = "force-dynamic";

type CompareProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Side-by-side comparator for up to 4 listings (`/compare?ids=1,2,3`).
 * Highlights the best option by $/m² construction automatically.
 */
export default async function ComparePage({ searchParams }: CompareProps) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.ids) ? sp.ids[0] : sp.ids;
  const idList = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (idList.length === 0) {
    return (
      <PageShell size="sm" className="flex min-h-[50vh] flex-col justify-center">
        <EmptyState
          icon={GitCompareArrows}
          title="Comparador"
          description="Elige hasta 4 inmuebles desde tus favoritos para compararlos lado a lado."
          action={
            <Link href="/favorites" className={buttonVariants()}>
              Ir a mis favoritos
            </Link>
          }
        />
      </PageShell>
    );
  }

  const listings = await getListingsByIds(idList);

  if (listings.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No se encontraron inmuebles con esos IDs.
        </p>
        <Link href="/favorites" className={buttonVariants({ className: "mt-4" })}>
          Volver a favoritos
        </Link>
      </div>
    );
  }

  // Financial metrics per listing; best $/m² construction gets highlighted.
  const rows = listings.map((l) => ({
    listing: l,
    precio_m2: l.construccion_m2 > 0 ? l.price / l.construccion_m2 : null,
    precio_m2_terreno: l.terreno_m2 > 0 ? l.price / l.terreno_m2 : null,
    discount:
      l.valor_avaluo != null && l.valor_avaluo > 0
        ? Math.round((1 - l.price / l.valor_avaluo) * 100)
        : null,
  }));

  const withM2 = rows.filter((r) => r.precio_m2 != null);
  const bestM2 =
    withM2.length > 0
      ? Math.min(...withM2.map((r) => r.precio_m2 as number))
      : null;

  return (
    <PageShell size="xl">
      <PageHeader
        eyebrow="Comprar"
        icon={GitCompareArrows}
        title="Comparador"
        description={`${listings.length} inmuebles · el mejor $/m² construcción se resalta automáticamente.`}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(({ listing: l, precio_m2, precio_m2_terreno, discount }) => {
          const isBest =
            precio_m2 != null && bestM2 != null && precio_m2 === bestM2;
          return (
            <div
              key={l.id}
              className={
                "relative flex flex-col rounded-lg border bg-card p-5 shadow-sm " +
                (isBest ? "border-primary ring-2 ring-primary/30" : "")
              }
            >
              {isBest && (
                <span className="absolute -top-3 right-3 flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  <Trophy className="size-3" /> Mejor $/m²
                </span>
              )}
              <Link
                href={`/property/${l.slug}`}
                className="font-semibold leading-snug hover:text-primary hover:underline"
              >
                {l.title}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {l.colonia}, {l.city}
              </p>

              <div className="mt-4 space-y-2 text-sm">
                <CompareRow label="Precio" value={`$${l.price.toLocaleString()}`} />
                <CompareRow
                  label="$/m² construcción"
                  value={
                    precio_m2 != null
                      ? `$${precio_m2.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : "—"
                  }
                  highlight={isBest}
                />
                <CompareRow
                  label="$/m² terreno"
                  value={
                    precio_m2_terreno != null
                      ? `$${precio_m2_terreno.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : "—"
                  }
                />
                <CompareRow
                  label="Construcción"
                  value={l.construccion_m2 > 0 ? `${l.construccion_m2} m²` : "—"}
                />
                <CompareRow
                  label="Terreno"
                  value={l.terreno_m2 > 0 ? `${l.terreno_m2} m²` : "—"}
                />
                <CompareRow
                  label="Habitaciones"
                  value={l.recamaras != null ? String(l.recamaras) : "—"}
                />
                <CompareRow
                  label="Baños"
                  value={l.banos != null ? String(l.banos) : "—"}
                />
                <CompareRow
                  label="% descuento avalúo"
                  value={discount != null ? `${discount}%` : "—"}
                />
              </div>

              <div className="mt-4 flex gap-2 pt-2">
                <Link
                  href={`/property/${l.slug}`}
                  className={buttonVariants({ size: "sm", className: "flex-1" })}
                >
                  Ver
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        ¿Quieres comparar desde tus favoritos?{" "}
        <Link href="/favorites" className="text-primary hover:underline">
          Abre tu tier list
        </Link>
      </p>
    </PageShell>
  );
}

function CompareRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-dashed pb-1 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          "text-xs font-medium " + (highlight ? "text-primary font-semibold" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}
