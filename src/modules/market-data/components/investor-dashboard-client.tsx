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
import { HotnessGauge } from "@/modules/market-data/components/hotness-gauge";
import { MapViewToggle, type MapView } from "@/modules/maps/components/map-view-toggle";
import { PropertiesMap } from "@/modules/maps/components/properties-map";
import { CategoryPills } from "@/modules/search/components/category-pills";
import {
  BedroomsSlider,
} from "@/modules/search/components/bedrooms-slider";
import {
  PriceRangeSlider,
  SALE_PRICE_MAX,
} from "@/modules/search/components/price-range-slider";
import type { PropertyMapMarker } from "@/modules/search/queries";
import { parseCategoriesParam } from "@/modules/lib/schemas";
import type { MapBounds } from "@/modules/lib/schemas";
import {
  estimateEscrituracion,
  estimatePredial,
  formatMxn,
} from "@/modules/lib/real-estate";
import { cn } from "@/lib/utils";
import type { InvestorItem } from "@/app/investor/page";
import type { InvestorTab } from "@/modules/lib/schemas";
import type { PropertyCategory, PropertyDealType } from "@/modules/lib/database.types";

const DEAL_THRESHOLD_PCT = 25;

/** Sort options available on the investor dashboard. */
type SortKey =
  | "newest"
  | "hot"
  | "price-asc"
  | "price-desc"
  | "m2-const-asc"
  | "m2-const-desc"
  | "m2-land-asc"
  | "m2-land-desc"
  | "avaluo-discount";

/** Comparators that always sink null/unknown values to the bottom. */
function compareAsc(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function compareDesc(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

/** Investor opportunities are all for-sale listings (deal_type, no rent). */
function toMapMarker(item: InvestorItem): PropertyMapMarker {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    city: item.city,
    colonia: item.colonia,
    price: item.price,
    currency: item.currency,
    type: "sale",
    images: item.image ? [item.image] : null,
    lat: item.lat,
    lng: item.lng,
  };
}

function inBounds(bounds: MapBounds, item: InvestorItem): boolean {
  return (
    item.lat >= bounds.minLat &&
    item.lat <= bounds.maxLat &&
    item.lng >= bounds.minLng &&
    item.lng <= bounds.maxLng
  );
}

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
  initialView?: MapView;
  initialBounds?: MapBounds | null;
};

/**
 * Investor dashboard: opportunity tabs driven by URL deal_type/category
 * filters, with per-category financial KPIs on each card, plus an
 * Airbnb-style Lista ⇄ Mapa ⇄ Dividido toggle. The map is fed by the
 * client-side filtered items (no extra API calls) and its zone pill filters
 * the grid.
 */
export function InvestorDashboardClient({
  items,
  activeTab,
  counts,
  initialView = "split",
  initialBounds = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<MapView>(initialView);
  const [bounds, setBounds] = useState<MapBounds | null>(initialBounds);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [maxM2Const, setMaxM2Const] = useState("");
  const [maxM2Land, setMaxM2Land] = useState("");
  const [minDiscount, setMinDiscount] = useState("");
  const [city, setCity] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [minBedrooms, setMinBedrooms] = useState(0);

  // Price filter. The slider ceiling is the highest listed price (rounded up
  // to a round number) so the range always spans the available inventory.
  const priceCeiling = useMemo(() => {
    const highest = items.reduce((max, i) => Math.max(max, i.price ?? 0), 0);
    if (highest <= 0) return SALE_PRICE_MAX;
    const magnitude = Math.pow(10, Math.floor(Math.log10(highest)));
    return Math.ceil(highest / magnitude) * magnitude;
  }, [items]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(priceCeiling);

  const cities = useMemo(() => {
    const set = new Set(items.map((i) => i.city).filter(Boolean));
    return [...set].sort();
  }, [items]);

  const maxConstNum = Number(maxM2Const) || Infinity;
  const maxLandNum = Number(maxM2Land) || Infinity;
  const minDiscountNum = Number(minDiscount) || 0;

  const filtered = useMemo(() => {
    const matches = items.filter((item) => {
      const constPerM2 = item.precio_m2_const ?? 0;
      const landPerM2 = item.precio_m2_terreno ?? 0;
      const discount = item.discountPct ?? 0;
      if (constPerM2 > maxConstNum) return false;
      if (landPerM2 > maxLandNum) return false;
      if (discount < minDiscountNum) return false;
      if (city !== "all" && item.city !== city) return false;
      if (minBedrooms > 0 && (item.recamaras ?? 0) < minBedrooms) return false;
      if (item.price < minPrice) return false;
      if (item.price > maxPrice) return false;
      return true;
    });

    if (sortBy === "newest") {
      // Server already returns listings newest-first; keep that order.
      return matches;
    }

    return [...matches].sort((a, b) => {
      switch (sortBy) {
        case "hot":
          return compareDesc(a.hotScore, b.hotScore);
        case "price-asc":
          return compareAsc(a.price, b.price);
        case "price-desc":
          return compareDesc(a.price, b.price);
        case "m2-const-asc":
          return compareAsc(a.precio_m2_const, b.precio_m2_const);
        case "m2-const-desc":
          return compareDesc(a.precio_m2_const, b.precio_m2_const);
        case "m2-land-asc":
          return compareAsc(a.precio_m2_terreno, b.precio_m2_terreno);
        case "m2-land-desc":
          return compareDesc(a.precio_m2_terreno, b.precio_m2_terreno);
        case "avaluo-discount":
          // Remates use the appraisal discount; other deals fall back to the
          // colonia discount so the sort stays meaningful on the "todos" tab.
          return compareDesc(
            a.discountAvaluo ?? a.discountPct,
            b.discountAvaluo ?? b.discountPct,
          );
        default:
          return 0;
      }
    });
  }, [items, maxConstNum, maxLandNum, minDiscountNum, city, sortBy, minPrice, maxPrice, minBedrooms]);

  // Pins for the map: one per filtered opportunity (all for-sale).
  const markers = useMemo(() => filtered.map(toMapMarker), [filtered]);

  // When a zone is active, the grid under the map honors it client-side.
  const zoneFiltered = useMemo(
    () => (bounds ? filtered.filter((item) => inBounds(bounds, item)) : filtered),
    [filtered, bounds],
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

  // Property-type multi-select, driven by the `categories` URL param. Pushing
  // to the URL re-fetches items server-side so tabs, badges and the list stay
  // consistent (same pattern as selectTab).
  const selectedCategories = useMemo(
    () => parseCategoriesParam(searchParams.get("categories")),
    [searchParams],
  );

  const setCategories = (next: PropertyCategory[]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("pageSize");
    if (next.length > 0) {
      params.set("categories", next.join(","));
    } else {
      params.delete("categories");
    }
    const qs = params.toString();
    router.push(qs ? `/investor?${qs}` : "/investor");
  };

  // View mode (list/map/split) lives in the URL, same as the other search pages.
  const changeView = (next: MapView) => {
    setView(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "split") {
      params.delete("view");
    } else {
      params.set("view", next);
    }
    const qs = params.toString();
    router.push(qs ? `/investor?${qs}` : "/investor", { scroll: false });
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
        <label className="block text-xs text-muted-foreground">
          Ordenar
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="mt-1 block rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="newest">Más recientes</option>
            <option value="hot">Más hot (oportunidad)</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="m2-const-asc">$/m² const: menor a mayor</option>
            <option value="m2-const-desc">$/m² const: mayor a menor</option>
            <option value="m2-land-asc">$/m² terreno: menor a mayor</option>
            <option value="m2-land-desc">$/m² terreno: mayor a menor</option>
            <option value="avaluo-discount">
              Mayor % descuento vs avalúo
            </option>
          </select>
        </label>

        <div className="w-full space-y-2 border-t pt-3">
          <span className="block text-xs text-muted-foreground">Precio</span>
          <PriceRangeSlider
            min={0}
            max={priceCeiling}
            step={Math.max(1, Math.round(priceCeiling / 100))}
            value={[minPrice, maxPrice]}
            onChange={([lo, hi]) => {
              setMinPrice(lo);
              setMaxPrice(hi);
            }}
          />
        </div>

        <div className="w-full space-y-2 border-t pt-3">
          <span className="block text-xs text-muted-foreground">
            Recámaras (mínimo)
          </span>
          <BedroomsSlider value={minBedrooms} onChange={setMinBedrooms} />
        </div>

        <div className="w-full space-y-2 border-t pt-3">
          <span className="block text-xs text-muted-foreground">
            Tipo de propiedad
          </span>
          <CategoryPills
            selected={selectedCategories}
            onChange={setCategories}
          />
        </div>
      </div>

      <div className="flex items-center justify-end">
        <MapViewToggle view={view} onChange={changeView} count={filtered.length} />
      </div>

      {view === "split" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              {zoneFiltered.length === 0
                ? "Ninguna oportunidad en esta zona"
                : `${zoneFiltered.length} ${
                    zoneFiltered.length === 1 ? "oportunidad" : "oportunidades"
                  } en esta zona`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {bounds
                ? "El mapa ajusta la cuadrícula a la zona visible."
                : "Mueve o acerca el mapa para filtrar por zona."}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {zoneFiltered.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-16 text-center sm:col-span-2">
                  <p className="text-sm text-muted-foreground">
                    No hay oportunidades en esta zona. Restablece la zona o prueba
                    otra pestaña.
                  </p>
                </div>
              ) : (
                zoneFiltered.map((item) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <InvestorCard item={item} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <PropertiesMap
              markers={markers}
              initialBounds={bounds}
              activeBounds={bounds}
              onApplyBounds={setBounds}
              onResetBounds={() => setBounds(null)}
              highlightedId={hoveredId}
              heightClass="h-[50vh] lg:h-[calc(100vh-11rem)]"
            />
          </div>
        </div>
      ) : view === "map" ? (
        <div className="space-y-6">
          <PropertiesMap
            markers={markers}
            initialBounds={bounds}
            activeBounds={bounds}
            onApplyBounds={setBounds}
            onResetBounds={() => setBounds(null)}
            highlightedId={hoveredId}
            heightClass="h-[60vh]"
          />

          <div>
            <h2 className="text-lg font-semibold">
              {zoneFiltered.length === 0
                ? "Ninguna oportunidad en esta zona"
                : `${zoneFiltered.length} ${
                    zoneFiltered.length === 1 ? "oportunidad" : "oportunidades"
                  } en esta zona`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {bounds
                ? "El mapa ajusta la cuadrícula a la zona visible."
                : "Mueve o acerca el mapa para filtrar por zona."}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {zoneFiltered.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-16 text-center sm:col-span-2 lg:col-span-3">
                  <p className="text-sm text-muted-foreground">
                    No hay oportunidades en esta zona. Restablece la zona o prueba
                    otra pestaña.
                  </p>
                </div>
              ) : (
                zoneFiltered.map((item) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <InvestorCard item={item} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
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
            filtered.map((item) => (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <InvestorCard item={item} />
              </div>
            ))
          )}
        </div>
      )}
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

        {item.price > 0 && (
          <p className="text-xs text-muted-foreground">
            Predial est. {formatMxn(estimatePredial(item.price))}/año ·
            Escrituración est. {formatMxn(estimateEscrituracion(item.price))}
          </p>
        )}

        <HotnessGauge score={item.hotScore} />

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
