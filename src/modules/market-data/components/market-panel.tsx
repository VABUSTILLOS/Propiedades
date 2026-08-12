"use client";

import { useState } from "react";

import type { MarketBenchmarksRow, PropertiesRow } from "@/modules/lib/database.types";

type Props = {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
};

const DEFAULT_RATE = 0.1049; // ~10.5% CAT MX average
const DEFAULT_TERM = 20; // years

/**
 * Market data panel: benchmark comps, AVM estimate, PITI-style payment calc.
 */
export function MarketPanel({ property, benchmark }: Props) {
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [downPaymentPct, setDownPaymentPct] = useState(0.1);

  const loanAmount = property.price * (1 - downPaymentPct);
  const monthlyRate = rate / 12;
  const n = term * 12;
  const monthlyPayment =
    monthlyRate === 0 || n === 0
      ? 0
      : (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

  const constPerM2 = property.construccion_m2 > 0 ? property.price / property.construccion_m2 : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Referencia de mercado</h3>
        {benchmark ? (
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Ciudad" value={benchmark.city} />
            <Row label="Colonia" value={benchmark.colonia} />
            <Row
              label="Promedio $/m² construido"
              value={`$${benchmark.avg_price_m2_const.toLocaleString()}`}
            />
            <Row
              label="Promedio $/m² terreno"
              value={`$${benchmark.avg_price_m2_land.toLocaleString()}`}
            />
            <Row
              label="Crecimiento / año"
              value={`${(benchmark.historical_growth_rate ?? 0).toFixed(2)}%`}
            />
            <Row
              label="Tu listado $/m²"
              value={`$${Math.round(constPerM2).toLocaleString()}`}
            />
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Aún no hay datos de referencia para {property.colonia}.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Estimación de pago</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimación de hipoteca, predial y mantenimiento (HOA).
        </p>

        <div className="mt-3 space-y-2">
          <label className="block text-xs text-muted-foreground">
            Enganche: {(downPaymentPct * 100).toFixed(0)}%
            <input
              type="range"
              min={10}
              max={70}
              value={downPaymentPct * 100}
              onChange={(e) => setDownPaymentPct(Number(e.target.value) / 100)}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            CAT: {(rate * 100).toFixed(1)}%
            <input
              type="range"
              min={9}
              max={15}
              step={0.1}
              value={rate * 100}
              onChange={(e) => setRate(Number(e.target.value) / 100)}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Plazo: {term} años
            <input
              type="range"
              min={5}
              max={30}
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
        </div>

        <p className="mt-4 text-2xl font-bold">
          ${Math.round(monthlyPayment).toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground"> / mes</span>
        </p>
        {(property.predial_anual ?? 0) > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            + ~${Math.round((property.predial_anual ?? 0) / 12).toLocaleString()}{" "}
            / mes predial
          </p>
        )}
        {(property.hoa_fee ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            + ${property.hoa_fee?.toLocaleString()} / mes HOA
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
