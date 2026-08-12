"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Flame,
  Landmark,
  School,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

import type {
  Json,
  MarketBenchmarksRow,
  PropertiesRow,
} from "@/modules/lib/database.types";
import { MarketPanel } from "@/modules/market-data/components/market-panel";
import { POIMap } from "@/modules/maps/components/poi-map";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
 * Residencia: Bento-grid photo gallery, description, POI map (schools +
 * transit) and a collapsible PITI payment calculator.
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
  const images = property.images ?? [];

  return (
    <div className="space-y-6">
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:grid-rows-2">
          {images.slice(0, 5).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={property.title}
              className={cn(
                "aspect-[4/3] w-full rounded-lg object-cover",
                i === 0 && "col-span-2 row-span-2 aspect-auto sm:h-full",
              )}
            />
          ))}
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No photos yet
        </div>
      )}

      {property.description && (
        <p className="whitespace-pre-line text-muted-foreground">
          {property.description}
        </p>
      )}

      {property.lat !== undefined && property.lng !== undefined ? (
        <POIMap lat={property.lat} lng={property.lng} className="h-80" />
      ) : null}

      <LifestyleLayer property={property} />

      <details className="group rounded-lg border bg-card p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
          <span>Calculadora de pago (PITI)</span>
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

function FinancialRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground/70">{hint}</p>}
      </div>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** Risk / lifestyle layer for the residential mode (Zillow-style neighborhood data). */
function LifestyleLayer({ property }: { property: PropertiesRow }) {
  const vibe = parseJsonArray(property.neighborhood_vibe);
  const schools = parseJsonArray(property.nearby_schools);

  const hasAny =
    property.noise_score != null ||
    property.flood_risk_level != null ||
    vibe.length > 0 ||
    schools.length > 0;

  if (!hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-muted-foreground" />
        <h3 className="font-semibold">Zona y estilo de vida</h3>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {property.noise_score != null && (
          <RiskTile
            icon={<Flame className="size-4" />}
            label="Ruido (0-10)"
            value={property.noise_score.toFixed(1)}
            tone={property.noise_score < 5 ? "good" : "bad"}
          />
        )}
        {property.flood_risk_level != null && (
          <RiskTile
            icon={<ShieldAlert className="size-4" />}
            label="Riesgo de inundación"
            value={property.flood_risk_level}
            tone={
              property.flood_risk_level.toLowerCase().includes("bajo")
                ? "good"
                : "bad"
            }
          />
        )}
      </div>

      {schools.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <School className="size-4" />
            <span className="font-medium text-foreground">
              Escuelas cercanas
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {schools.map((school) => (
              <li key={school} className="text-sm text-muted-foreground">
                {school}
              </li>
            ))}
          </ul>
        </div>
      )}

      {vibe.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span className="font-medium text-foreground">What Locals Say</span>
          </div>
          <ul className="mt-2 space-y-1">
            {vibe.map((comment) => (
              <li
                key={comment}
                className="text-sm text-muted-foreground first:mt-0"
              >
                “{comment}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RiskTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "good" | "bad";
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-lg font-bold",
          tone === "good" ? "text-emerald-600" : "text-amber-600",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function parseJsonArray(value: Json): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}
