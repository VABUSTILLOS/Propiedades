"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Hammer,
  Repeat,
  Store,
  Tractor,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { InvestorItem } from "@/app/investor/page";
import type { InvestorTab } from "@/modules/lib/schemas";
import type { PropertyDealType } from "@/modules/lib/database.types";

const DEAL_THRESHOLD_PCT = 25;

const TAB_DEFS: {
  value: InvestorTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "todos", label: "Todos", icon: Store },
  { value: "remate", label: "Remates", icon: Hammer },
  { value: "flipping", label: "Flipping", icon: Wrench },
  { value: "traspaso", label: "Traspasos", icon: Repeat },
  { value: "comercial", label: "Comercial", icon: Banknote },
  { value: "terreno", label: "Terrenos", icon: Tractor },
];

type Props = {
  items: InvestorItem[];
  activeTab: InvestorTab;
  counts: Record<InvestorTab, number>;
};

/**
 * Investor dashboard: opportunity tabs driven by URL deal_type/category
 * filters, with per-category financial KPIs on each card.
 */
export function InvestorDashboardClient({ items, activeTab, counts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [maxM2Const, setMaxM2Const] = useState("");
  const [maxM2Land, setMaxM2Land] = useState("");
  const [minDiscount, setMinDiscount] = useState("");
  const [city, setCity] = useState("all");

  const cities = useMemo(() => {
    const set = new Set(items.map((i) => i.city).filter(Boolean));
    return [...set].sort();
  }, [items]);

  const maxConstNum = Number(maxM2Const) || Infinity;
  const maxLandNum = Number(maxM2Land) || Infinity;
  const minDiscountNum = Number(minDiscount) || 0;

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const constPerM2 = item.precio_m2_const ?? 0;
        const landPerM2 = item.precio_m2_terreno ?? 0;
        const discount = item.discountPct ?? 0;
        if (constPerM2 > maxConstNum) return false;
        if (landPerM2 > maxLandNum) return false;
        if (discount < minDiscountNum) return false;
        if (city !== "all" && item.city !== city) return false;
        return true;
      }),
    [items, maxConstNum, maxLandNum, minDiscountNum, city],
  );

  const selectTab = (value: InvestorTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("pageSize");
    if (value === "todos") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.push(qs ? `/investor?${qs}` : "/investor");
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => selectTab(v as InvestorTab)}>
        <TabsList variant="line" className="w-full overflow-x-auto">
          {TAB_DEFS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-none gap-1.5 rounded-lg px-4 py-1.5 data-active:shadow-none"
            >
              <Icon className="size-3.5" />
              {label}
              <span
                className={cn(
                  "ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                  value === activeTab
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {counts[value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <FilterField
          label="Max $/m² construcción"
          value={maxM2Const}
          onChange={setMaxM2Const}
          placeholder="Ej. 25000"
        />
        <FilterField
          label="Max $/m² terreno"
          value={maxM2Land}
          onChange={setMaxM2Land}
          placeholder="Ej. 12000"
        />
        <FilterField
          label="Min % descuento"
          value={minDiscount}
          onChange={setMinDiscount}
          placeholder="Ej. 15"
        />
        <label className="block text-xs text-muted-foreground">
          Ciudad
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 block rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="all">Todas</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-16 text-center sm:col-span-2 lg:col-span-3">
            <p className="text-sm text-muted-foreground">
              No hay oportunidades que coincidan con esta vista.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Prueba otra pestaña o ajusta los filtros de $/m², descuento o ciudad.
            </p>
          </div>
        ) : (
          filtered.map((item) => <InvestorCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

function FilterField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-40 rounded-md border bg-background px-2 py-1 text-sm"
      />
    </label>
  );
}

const DEAL_TYPE_BADGES: Record<PropertyDealType, { label: string; className: string }> = {
  venta_directa: { label: "Venta directa", className: "bg-slate-600" },
  remate_bancario: { label: "Remate bancario", className: "bg-emerald-600" },
  flipping: { label: "Flipping", className: "bg-amber-600" },
  traspaso: { label: "Traspaso", className: "bg-sky-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  local: "Local",
  bodega: "Bodega",
  terreno: "Terreno",
};

function InvestorCard({ item }: { item: InvestorItem }) {
  const constPerM2 = item.precio_m2_const ?? 0;
  const landPerM2 = item.precio_m2_terreno ?? 0;
  const discount = item.discountPct;
  const isDeal = (discount ?? 0) >= DEAL_THRESHOLD_PCT;
  const dealBadge = DEAL_TYPE_BADGES[item.dealType] ?? DEAL_TYPE_BADGES.venta_directa;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt={item.title}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          Sin foto
        </div>
      )}

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/property/${item.slug}`}
            className="font-semibold leading-snug hover:underline"
          >
            {item.title}
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge className={dealBadge.className}>{dealBadge.label}</Badge>
          {isDeal && (
            <Badge variant="outline" className="text-emerald-700">
              Oportunidad
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {CATEGORY_LABELS[item.category] ?? item.category} · {item.colonia},{" "}
          {item.city}
        </p>
        <p className="text-sm font-semibold">
          ${item.price.toLocaleString()}{" "}
          <span className="font-normal text-muted-foreground">
            {item.currency}
          </span>
        </p>

        <InvestmentKpis item={item} />

        <dl className="space-y-1 text-xs text-muted-foreground">
          {constPerM2 > 0 && (
            <div className="flex justify-between">
              <dt>$/m² const</dt>
              <dd className="font-medium text-foreground">
                ${Math.round(constPerM2).toLocaleString()}
                {item.benchmarkConst != null && (
                  <span className="ml-1 text-muted-foreground">
                    / bench ${item.benchmarkConst.toLocaleString()}
                  </span>
                )}
              </dd>
            </div>
          )}
          {landPerM2 > 0 && (
            <div className="flex justify-between">
              <dt>$/m² terreno</dt>
              <dd className="font-medium text-foreground">
                ${Math.round(landPerM2).toLocaleString()}
                {item.benchmarkLand != null && (
                  <span className="ml-1 text-muted-foreground">
                    / bench ${item.benchmarkLand.toLocaleString()}
                  </span>
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>% descuento vs colonia</dt>
            <dd className="font-medium">
              {discount == null ? (
                <span>Sin dato</span>
              ) : discount >= 0 ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-600">
                  <ArrowDownRight className="size-3" />
                  {discount.toFixed(1)}%
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-amber-600">
                  <ArrowUpRight className="size-3" />
                  {Math.abs(discount).toFixed(1)}%
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

/**
 * Per-deal-type financial KPIs: remate → avalúo/institution/date;
 * flipping → repair cost + ARV + projected profit; traspaso → terms;
 * comercial/terreno → cap-rate and estimated rent.
 */
function InvestmentKpis({ item }: { item: InvestorItem }) {
  if (item.dealType === "remate_bancario") {
    return (
      <dl className="space-y-1 rounded-md bg-emerald-50 p-2 text-xs">
        {item.institucionBancaria && (
          <div className="flex justify-between">
            <dt className="text-emerald-700">Institución</dt>
            <dd className="font-medium text-emerald-900">
              {item.institucionBancaria}
            </dd>
          </div>
        )}
        {item.fechaRemate && (
          <div className="flex justify-between">
            <dt className="text-emerald-700">Fecha de remate</dt>
            <dd className="font-medium text-emerald-900">{item.fechaRemate}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-emerald-700">% descuento vs avalúo</dt>
          <dd className="font-medium text-emerald-900">
            {item.discountAvaluo != null
              ? `${item.discountAvaluo.toFixed(1)}%`
              : "Sin dato"}
          </dd>
        </div>
      </dl>
    );
  }

  if (item.dealType === "flipping") {
    const arv = item.valorPostReparacion;
    const repair = item.costoReparacion;
    const profit =
      arv != null && repair != null ? arv - item.price - repair : null;
    return (
      <dl className="space-y-1 rounded-md bg-amber-50 p-2 text-xs">
        {repair != null && (
          <div className="flex justify-between">
            <dt className="text-amber-700">Costo de reparación</dt>
            <dd className="font-medium text-amber-900">
              ${repair.toLocaleString()}
            </dd>
          </div>
        )}
        {arv != null && (
          <div className="flex justify-between">
            <dt className="text-amber-700">Valor post-reparación (ARV)</dt>
            <dd className="font-medium text-amber-900">
              ${arv.toLocaleString()}
            </dd>
          </div>
        )}
        {profit != null && (
          <div className="flex justify-between">
            <dt className="text-amber-700">Utilidad proyectada</dt>
            <dd className="font-semibold text-emerald-700">
              ${profit.toLocaleString()}
            </dd>
          </div>
        )}
      </dl>
    );
  }

  if (item.dealType === "traspaso") {
    return (
      <dl className="space-y-1 rounded-md bg-sky-50 p-2 text-xs">
        <div className="flex justify-between">
          <dt className="text-sky-700">Traspaso</dt>
          <dd className="font-medium text-sky-900">
            {item.condicionesTraspaso
              ? item.condicionesTraspaso
              : "Condiciones por acordar"}
          </dd>
        </div>
      </dl>
    );
  }

  // Commercial / land / residential fall back to cap-rate + rent KPIs.
  return (
    <dl className="space-y-1 rounded-md bg-muted/60 p-2 text-xs">
      {item.capRate != null && (
        <div className="flex justify-between">
          <dt>Cap-rate proyectado</dt>
          <dd className="font-medium text-foreground">
            {(item.capRate * 100).toFixed(1)}%
          </dd>
        </div>
      )}
      {item.rentaEstimada != null && (
        <div className="flex justify-between">
          <dt>Renta estimada</dt>
          <dd className="font-medium text-foreground">
            ${item.rentaEstimada.toLocaleString()}/mes
          </dd>
        </div>
      )}
    </dl>
  );
}
