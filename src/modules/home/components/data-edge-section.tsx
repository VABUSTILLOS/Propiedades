import { Check, Gauge, Minus, Percent, Receipt, TrendingUp } from "lucide-react";

import { FolioLabel } from "@/modules/home/components/folio-label";

const DATA_POINTS = [
  {
    icon: Percent,
    index: "01",
    title: "Descuento vs colonia",
    description:
      "El % exacto que cada propiedad gana o pierde contra el precio por m² benchmark de su colonia.",
  },
  {
    icon: Receipt,
    index: "02",
    title: "Costos de cierre",
    description:
      "Predial anual y escrituración estimados antes de que levantes el teléfono. Sin sorpresas al escriturar.",
  },
  {
    icon: TrendingUp,
    index: "03",
    title: "Renta potencial",
    description:
      "Renta mensual estimada según categoría y precio, para comparar cada oportunidad como inversionista.",
  },
  {
    icon: Gauge,
    index: "04",
    title: "Score de oportunidad",
    description:
      "Descuento y $/m² combinados en un número de 0 a 100. El mercado, ordenado en segundos.",
  },
];

const COMPARISON_ROWS = [
  "% de descuento vs benchmark de colonia",
  "Predial y escrituración estimados",
  "Renta potencial mensual estimada",
  "Score de oportunidad por propiedad",
  "Remates y traspasos con % sobre avalúo",
];

/**
 * "Ventaja de información" — the differentiation manifesto, on dark ink.
 * Four exclusive data points in a hairline-divided grid, then a ledger
 * comparing what traditional portals publish vs what the registry shows
 * on every property. Server-safe.
 */
export function DataEdgeSection() {
  return (
    <section className="relative overflow-hidden bg-[#180F08] text-[#FBF6F0]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(251,246,240,0.05) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-20">
        <FolioLabel index="02" title="Ventaja de información" light />
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Los números que <em className="font-display italic">no consigues</em>{" "}
          en ningún otro lado
        </h2>
        <p className="mt-4 max-w-2xl text-white/60">
          Cada propiedad del registro se publica con su análisis completo.
          Esto es lo que ves aquí y en ningún portal tradicional:
        </p>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {DATA_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <div key={point.index} className="bg-[#180F08] p-6">
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-[#D67E3C]" aria-hidden />
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">
                    {point.index}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold">{point.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_6.5rem] bg-white/5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
            <span className="px-4 py-3.5 sm:px-6">Dato por propiedad</span>
            <span className="px-2 py-3.5 text-center">Portales</span>
            <span className="bg-white/[0.06] px-2 py-3.5 text-center text-[#7BC796]">
              Propiedades
            </span>
          </div>
          {COMPARISON_ROWS.map((row) => (
            <div
              key={row}
              className="grid grid-cols-[minmax(0,1fr)_5.5rem_6.5rem] border-t border-white/10 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]"
            >
              <span className="px-4 py-4 text-sm text-white/80 sm:px-6">
                {row}
              </span>
              <span className="flex items-center justify-center px-2 py-4">
                <Minus className="size-4 text-white/20" aria-label="No disponible" />
              </span>
              <span className="flex items-center justify-center bg-white/[0.06] px-2 py-4">
                <Check className="size-4 text-[#7BC796]" aria-label="Incluido" />
              </span>
            </div>
          ))}
        </div>

        <p className="mt-8 border-l-2 border-[#D67E3C] pl-4 font-mono text-xs uppercase tracking-[0.18em] text-white/50">
          Metodología abierta — cada cifra muestra cómo se calcula
        </p>
      </div>
    </section>
  );
}
