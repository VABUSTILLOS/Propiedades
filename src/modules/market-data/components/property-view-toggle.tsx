"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Download,
  Landmark,
} from "lucide-react";

import type { jsPDF } from "jspdf";

import type {
  MarketBenchmarksRow,
  PropertiesRow,
  PropertyCategory,
} from "@/modules/lib/database.types";
import {
  estimateMantenimiento,
  estimatePredial,
  formatMxn,
} from "@/modules/lib/real-estate";
import { MarketPanel } from "@/modules/market-data/components/market-panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  estimateMantenimiento,
  estimatePredial,
  formatMxn,
} from "@/modules/lib/real-estate";
import { DownloadInvestmentPdfButton } from "@/modules/market-data/components/download-investment-pdf-button";

type Props = {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
  discountPct: number | null;
  initialMode?: Mode;
};

type Mode = "residencia" | "inversionista";

/**
 * Residential vs Investor view toggle for a property detail page.
 *
 * Residencia: property description and an expanded payment calculator.
 * Inversionista: financial table built on the DB generated $/m² columns and
 * the colonia discount computed server-side.
 */
export function PropertyViewToggle({
  property,
  benchmark,
  discountPct,
  initialMode = "residencia",
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div>
      <div className="mb-6 inline-flex rounded-full border bg-muted/40 p-1">
        <ModeTab
          active={mode === "residencia"}
          onClick={() => setMode("residencia")}
          icon={<Landmark className="size-4" />}
          label="Residencia"
        />
        <ModeTab
          active={mode === "inversionista"}
          onClick={() => setMode("inversionista")}
          icon={<Building2 className="size-4" />}
          label="Inversionista"
        />
      </div>

      {mode === "residencia" ? (
        <ResidentialView property={property} benchmark={benchmark} />
      ) : (
        <InvestorView
          property={property}
          benchmark={benchmark}
          discountPct={discountPct}
        />
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ResidentialView({
  property,
  benchmark,
}: {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
}) {
  return (
    <div className="space-y-6">
      <details open className="group rounded-lg border bg-card p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
          <span>Calculadora de pago</span>
          <span className="text-xs font-normal text-muted-foreground">
            Estima tu mensualidad
          </span>
        </summary>
        <div className="mt-4">
          <MarketPanel property={property} benchmark={benchmark} />
        </div>
      </details>
    </div>
  );
}

/**
 * Estimated monthly rent potential based on 85% of the listing price and the
 * property category. Local/bodega properties use a flat 0.85% rate; everything
 * else uses a tiered rate that decreases as the price increases.
 */
function calcularPosibleRenta(property: PropertiesRow): number {
  const price = property.price * 0.85;
  const category = property.category;

  if (category === "local" || category === "bodega") {
    return price * 0.0085;
  }
  if (price <= 1_000_000) return price * 0.008;
  if (price <= 1_500_000) return price * 0.009;
  if (price <= 2_500_000) return price * 0.0075;
  if (price <= 3_500_000) return price * 0.007;
  return price * 0.006;
}

function InvestorView({
  property,
  benchmark,
  discountPct,
}: {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
  discountPct: number | null;
}) {
  const precioM2Const =
    property.precio_m2_const ??
    (property.construccion_m2 > 0
      ? property.price / property.construccion_m2
      : 0);
  const precioM2Terreno =
    property.precio_m2_terreno ??
    (property.terreno_m2 > 0 ? property.price / property.terreno_m2 : 0);

  const benchmarkConst =
    benchmark?.avg_price_m2_const != null
      ? Math.round(benchmark.avg_price_m2_const)
      : null;
  const benchmarkLand =
    benchmark?.avg_price_m2_land != null
      ? Math.round(benchmark.avg_price_m2_land)
      : null;

  return (
    <div className="space-y-6">
      <InvestmentDealPanel
        property={property}
        benchmark={benchmark}
        discountPct={discountPct}
      />

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <h3 className="font-semibold">Tabla financiera</h3>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <FinancialRow
            label="Precio de venta"
            value={`$${property.price.toLocaleString()} ${property.currency}`}
          />
          <FinancialRow
            label="Posible Renta"
            value={`$${Math.round(calcularPosibleRenta(property)).toLocaleString()}/mes`}
          />
          <FinancialRow
            label="Predial estimado (anual)"
            value={formatMxn(estimatePredial(property.price))}
          />
          <FinancialRow
            label="Mantenimiento anual estimado"
            value={formatMxn(estimateMantenimiento(property.price))}
            hint="1% del valor de la propiedad"
          />
          <FinancialRow
            label="Precio por m² construido"
            value={`$${Math.round(precioM2Const).toLocaleString()} / m²`}
            hint={
              benchmarkConst != null
                ? `Benchmark colonia: $${benchmarkConst.toLocaleString()} / m²`
                : undefined
            }
          />
          <FinancialRow
            label="Precio por m² de terreno"
            value={`$${Math.round(precioM2Terreno).toLocaleString()} / m²`}
            hint={
              benchmarkLand != null
                ? `Benchmark colonia: $${benchmarkLand.toLocaleString()} / m²`
                : undefined
            }
          />
          <FinancialRow
            label="% Descuento vs colonia"
            value={
              discountPct == null ? (
                <span className="text-muted-foreground">Sin dato</span>
              ) : discountPct >= 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <ArrowDownRight className="size-4" />
                  {discountPct.toFixed(1)}% abajo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                  <ArrowUpRight className="size-4" />
                  {Math.abs(discountPct).toFixed(1)}% arriba
                </span>
              )
            }
          />
          {property.price > 0 && (
            <>
              <FinancialRow
                label="Predial estimado (anual)"
                value={formatMxn(estimatePredial(property.price))}
              />
              <FinancialRow
                label="Mantenimiento anual estimado"
                value={formatMxn(estimateMantenimiento(property.price))}
              />
            </>
          )}
          {benchmark && (
            <>
              <FinancialRow
                label="Crecimiento anual de la colonia"
                value={`${(benchmark.historical_growth_rate ?? 0).toFixed(2)}%`}
              />
              <FinancialRow
                label="Benchmark: $/m² const. promedio"
                value={
                  benchmarkConst != null
                    ? `$${benchmarkConst.toLocaleString()}`
                    : "Sin dato"
                }
              />
              <FinancialRow
                label="Benchmark: $/m² terreno promedio"
                value={
                  benchmarkLand != null
                    ? `$${benchmarkLand.toLocaleString()}`
                    : "Sin dato"
                }
              />
            </>
          )}
        </dl>
      </div>

      {discountPct == null && !benchmark && (
        <Badge variant="secondary" className="text-xs">
          Sin datos de mercado para {property.colonia}, {property.city}
        </Badge>
      )}
    </div>
  );
}

/**
 * Deal-type specific investment panel: shows the KPI block that matches
 * the listing's deal_type (remate / flipping / traspaso / comercial-terreno).
 */
function InvestmentDealPanel({
  property,
  benchmark,
  discountPct,
}: {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
  discountPct: number | null;
}) {
  const dealType = property.deal_type ?? "venta_directa";
  const dealLabel = getDealLabel(dealType);

  const dealTone =
    dealType === "remate_bancario"
      ? "bg-emerald-500/10 text-emerald-700"
      : dealType === "flipping"
        ? "bg-amber-500/10 text-amber-700"
        : dealType === "traspaso"
          ? "bg-sky-500/10 text-sky-700"
          : "bg-muted text-muted-foreground";

  const kpis = buildDealKpis(property);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <h3 className="font-semibold">Ficha de inversión</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadFichaPdf({ property, benchmark, discountPct })}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Descargar PDF
          </button>
          <Badge className={cn("text-xs", dealTone)}>{dealLabel}</Badge>
        </div>
      </div>

      <DownloadInvestmentPdfButton
        property={property}
        benchmark={benchmark}
        discountPct={discountPct}
        className="mt-3 w-full"
      />

      <dl className="mt-4 space-y-3 text-sm">
        {kpis.map((kpi) => (
          <FinancialRow
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
          />
        ))}
      </dl>
    </div>
  );
}

/**
 * Estimates a monthly rent based on the listing price and property category.
 *
 * Comercial categories (local/bodega) use a fixed 0.85% monthly rate; other
 * categories use a rate that steps down as the price grows.
 */
function estimateMonthlyRent(price: number, category: PropertyCategory) {
  if (category === "local" || category === "bodega") {
    return price * 0.0085;
  }
  if (price <= 1_000_000) return price * 0.008;
  if (price <= 1_500_000) return price * 0.009;
  if (price <= 2_500_000) return price * 0.0075;
  if (price <= 3_500_000) return price * 0.007;
  return price * 0.006;
}

type DealKpi = { label: string; value: string; hint?: string };

function getDealLabel(dealType: string): string {
  return dealType === "remate_bancario"
    ? "Remate bancario"
    : dealType === "flipping"
      ? "Flipping"
      : dealType === "traspaso"
        ? "Traspaso"
        : "Venta directa";
}

/**
 * Collects the KPI rows that apply to the listing's deal type. Shared between
 * the on-screen panel and the downloadable PDF so both stay in sync.
 */
function buildDealKpis(property: PropertiesRow): DealKpi[] {
  const dealType = property.deal_type ?? "venta_directa";
  const category = property.category ?? "casa";

  const isRemate = dealType === "remate_bancario";
  const isFlipping = dealType === "flipping";
  const isTraspaso = dealType === "traspaso";
  const isComercialTerreno = ["local", "bodega", "terreno"].includes(category);

  const kpis: DealKpi[] = [];

  if (isRemate) {
    if (property.institucion_bancaria) {
      kpis.push({ label: "Institución bancaria", value: property.institucion_bancaria });
    }
    if (property.fecha_remate) {
      kpis.push({
        label: "Fecha del remate",
        value: new Date(property.fecha_remate).toLocaleDateString("es-MX"),
      });
    }
    if (property.porcentaje_descuento_avaluo != null) {
      kpis.push({
        label: "Descuento vs avalúo",
        value: `${(property.porcentaje_descuento_avaluo * 100).toFixed(1)}%`,
      });
    }
  }

  if (isFlipping) {
    if (property.costo_reparacion_estimado != null) {
      kpis.push({
        label: "Costo estimado de reparación",
        value: `$${property.costo_reparacion_estimado.toLocaleString()} MXN`,
      });
    }
    if (property.valor_post_reparacion_estimado != null) {
      kpis.push({
        label: "Valor post-reparación (ARV)",
        value: `$${property.valor_post_reparacion_estimado.toLocaleString()} MXN`,
      });
    }
    if (
      property.costo_reparacion_estimado != null &&
      property.valor_post_reparacion_estimado != null
    ) {
      kpis.push({
        label: "Utilidad proyectada",
        value: `$${Math.max(
          0,
          property.valor_post_reparacion_estimado -
            property.price -
            property.costo_reparacion_estimado,
        ).toLocaleString()} MXN`,
        hint: "ARV - precio de compra - costo de reparación",
      });
    }
  }

  if (isTraspaso) {
    kpis.push({
      label: "Condiciones del traspaso",
      value: property.condiciones_traspaso || "Sin condiciones registradas",
    });
    kpis.push({
      label: "Precio de traspaso",
      value: `$${property.price.toLocaleString()} ${property.currency}`,
    });
  }

  if (!isRemate && !isFlipping && !isTraspaso) {
    if (property.cap_rate_projected != null) {
      kpis.push({
        label: "Cap rate proyectado",
        value: `${(property.cap_rate_projected * 100).toFixed(2)}%`,
      });
    }
    if (property.estimated_monthly_rent != null) {
      kpis.push({
        label: "Renta mensual estimada",
        value: `$${property.estimated_monthly_rent.toLocaleString()}/mes`,
      });
    }
    if (isComercialTerreno) {
      kpis.push({
        label: "Clase de activo",
        value:
          category === "terreno"
            ? "Terreno / suelo"
            : category === "bodega"
              ? "Bodega / industrial"
              : "Local comercial",
      });
    }
  }

  return kpis;
}

/** Sanitize text for the standard PDF fonts (WinAnsi encoding). */
function pdfSafe(text: string): string {
  return text
    .replace(/−/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/·/g, ".")
    .replace(/×/g, "x")
    .replace(/’/g, "'")
    .replace(/[“”]/g, '"');
}

function drawPdfSectionTitle(doc: jsPDF, title: string, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(title, x, y);
  return y + 20;
}

function drawPdfRows(
  doc: jsPDF,
  rows: DealKpi[],
  x: number,
  y: number,
  pageWidth: number,
): number {
  const rightX = pageWidth - x;
  const labelWidth = 240;

  for (const row of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    const labelLines = doc.splitTextToSize(pdfSafe(row.label), labelWidth);
    doc.text(labelLines, x, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(pdfSafe(row.value), rightX, y, { align: "right" });

    y += Math.max(labelLines.length, 1) * 13 + 4;

    if (row.hint) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const hintLines = doc.splitTextToSize(
        pdfSafe(row.hint),
        pageWidth - x * 2,
      );
      doc.text(hintLines, x, y + 2);
      y += hintLines.length * 10 + 4;
    }

    if (y > doc.internal.pageSize.getHeight() - x) {
      doc.addPage();
      y = x;
    }
  }

  return y;
}

/** Generates the property investment ficha as a PDF and triggers a download. */
async function downloadFichaPdf({
  property,
  benchmark,
  discountPct,
}: {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
  discountPct: number | null;
}) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "pt", format: "letter" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ---- Header ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  const titleLines = doc.splitTextToSize(pdfSafe(property.title), contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 22 + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  const address = pdfSafe(
    [property.address, property.colonia, property.city, property.state]
      .filter(Boolean)
      .join(" · "),
  );
  const addressLines = doc.splitTextToSize(address, contentWidth);
  doc.text(addressLines, margin, y);
  y += addressLines.length * 14 + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(
    pdfSafe(`${formatMxn(property.price)} ${property.currency}`),
    margin,
    y,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(
    pdfSafe(getDealLabel(property.deal_type ?? "venta_directa")),
    pageWidth - margin,
    y,
    { align: "right" },
  );
  y += 30;

  doc.setDrawColor(210, 210, 210);
  doc.line(margin, y, pageWidth - margin, y);
  y += 26;

  // ---- Financial table ----
  const precioM2Const =
    property.precio_m2_const ??
    (property.construccion_m2 > 0
      ? property.price / property.construccion_m2
      : 0);
  const precioM2Terreno =
    property.precio_m2_terreno ??
    (property.terreno_m2 > 0 ? property.price / property.terreno_m2 : 0);

  const posibleRenta = estimateMonthlyRent(
    property.price,
    property.category,
  );

  const benchmarkConst =
    benchmark?.avg_price_m2_const != null
      ? Math.round(benchmark.avg_price_m2_const)
      : null;
  const benchmarkLand =
    benchmark?.avg_price_m2_land != null
      ? Math.round(benchmark.avg_price_m2_land)
      : null;

  const financialRows: DealKpi[] = [
    {
      label: "Precio de venta",
      value: `$${property.price.toLocaleString()} ${property.currency}`,
    },
    {
      label: "Posible Renta",
      value: `$${posibleRenta.toLocaleString()}/mes`,
    },
    {
      label: "Precio por m² construido",
      value: `$${Math.round(precioM2Const).toLocaleString()} / m²`,
      hint:
        benchmarkConst != null
          ? `Benchmark colonia: $${benchmarkConst.toLocaleString()} / m²`
          : undefined,
    },
    {
      label: "Precio por m² de terreno",
      value: `$${Math.round(precioM2Terreno).toLocaleString()} / m²`,
      hint:
        benchmarkLand != null
          ? `Benchmark colonia: $${benchmarkLand.toLocaleString()} / m²`
          : undefined,
    },
    {
      label: "% Descuento vs colonia",
      value:
        discountPct == null
          ? "Sin dato"
          : discountPct >= 0
            ? `${discountPct.toFixed(1)}% abajo`
            : `${Math.abs(discountPct).toFixed(1)}% arriba`,
    },
    ...(property.price > 0
      ? [
          {
            label: "Predial estimado (anual)",
            value: formatMxn(estimatePredial(property.price)),
          },
          {
            label: "Mantenimiento anual estimado",
            value: formatMxn(estimateMantenimiento(property.price)),
          },
        ]
      : []),
    ...(benchmark
      ? [
          {
            label: "Crecimiento anual de la colonia",
            value: `${(benchmark.historical_growth_rate ?? 0).toFixed(2)}%`,
          },
          {
            label: "Benchmark: $/m² const. promedio",
            value:
              benchmarkConst != null
                ? `$${benchmarkConst.toLocaleString()}`
                : "Sin dato",
          },
          {
            label: "Benchmark: $/m² terreno promedio",
            value:
              benchmarkLand != null
                ? `$${benchmarkLand.toLocaleString()}`
                : "Sin dato",
          },
        ]
      : []),
  ];

  y = drawPdfSectionTitle(doc, "Tabla financiera", margin, y);
  y = drawPdfRows(doc, financialRows, margin, y, pageWidth);
  y += 16;

  y = drawPdfSectionTitle(doc, "KPIs del deal", margin, y);
  y = drawPdfRows(doc, buildDealKpis(property), margin, y, pageWidth);

  // ---- Footer ----
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = new Date().toLocaleString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    pdfSafe(`Documento generado el ${generatedAt}`),
    pageWidth / 2,
    pageHeight - 30,
    { align: "center" },
  );

  doc.save(`ficha-inversion-${property.slug}.pdf`);
}

function FinancialRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {  return (    <div className="flex items-start justify-between gap-4">
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground/70">{hint}</p>}
      </div>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

