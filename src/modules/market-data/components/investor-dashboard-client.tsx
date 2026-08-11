"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InvestorItem } from "@/app/investor/page";

const DEAL_THRESHOLD_PCT = 25;

type Props = {
  items: InvestorItem[];
};

/**
 * Investor dashboard: filter listings by financial KPIs and surface
 * distressed deals (≥25% discount vs colonia benchmark).
 */
export function InvestorDashboardClient({ items }: Props) {
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

  const deals = useMemo(
    () =>
      items
        .filter((item) => (item.discountPct ?? 0) >= DEAL_THRESHOLD_PCT)
        .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0))
        .slice(0, 8),
    [items],
  );

  return (
    <div className="space-y-8">
      {deals.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-emerald-600" />
            <h2 className="font-semibold text-emerald-800">
              Remates detectados (≥{DEAL_THRESHOLD_PCT}% ahorro vs colonia)
            </h2>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {deals.map((deal) => (
              <li key={deal.id}>
                <Link
                  href={`/property/${deal.slug}`}
                  className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm hover:underline"
                >
                  <span className="font-medium">{deal.title}</span>
                  <span className="font-semibold text-emerald-700">
                    {(deal.discountPct ?? 0).toFixed(1)}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              No properties match the current filters.
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

function InvestorCard({ item }: { item: InvestorItem }) {
  const constPerM2 = item.precio_m2_const ?? 0;
  const landPerM2 = item.precio_m2_terreno ?? 0;
  const discount = item.discountPct;
  const isDeal = (discount ?? 0) >= DEAL_THRESHOLD_PCT;

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
          No photo
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
          {isDeal && <Badge className="bg-emerald-600">Remate</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {item.colonia}, {item.city}
        </p>
        <p className="text-sm font-semibold">
          ${item.price.toLocaleString()}{" "}
          <span className="font-normal text-muted-foreground">
            {item.currency}
          </span>
        </p>

        <dl className="space-y-1 text-xs text-muted-foreground">
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
