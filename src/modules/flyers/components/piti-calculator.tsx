"use client";

import { useState } from "react";

type Props = {
  price: number;
  currency: string;
  hoaFee?: number | null;
  predialAnual?: number | null;
};

const DEFAULT_RATE = 0.1049; // ~10.5% APR MX average
const DEFAULT_TERM = 20; // years

/**
 * PITI calculator (Principal + Interest + Taxes + Insurance / HOA).
 * Used on the public flyer and in the residential property view.
 * Inputs mirror what a Mexican buyer needs before touring.
 */
export function PitiCalculator({ price, currency, hoaFee, predialAnual }: Props) {
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [downPaymentPct, setDownPaymentPct] = useState(0.2);

  const downPayment = price * downPaymentPct;
  const loanAmount = price - downPayment;
  const monthlyRate = rate / 12;
  const n = term * 12;

  const principalInterest =
    monthlyRate === 0 || n === 0
      ? 0
      : (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

  const monthlyTaxes = predialAnual ? predialAnual / 12 : 0;
  const monthlyHoa = hoaFee ?? 0;
  const totalMonthly = principalInterest + monthlyTaxes + monthlyHoa;

  const fmt = (value: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          Tasa anual (CAT)
          <input
            type="number"
            step="0.001"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
            className="block w-full rounded-md border bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Plazo (años)
          <input
            type="number"
            min={1}
            max={40}
            value={term}
            onChange={(e) => setTerm(Number(e.target.value) || 0)}
            className="block w-full rounded-md border bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Enganche (%)
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(downPaymentPct * 100)}
            onChange={(e) =>
              setDownPaymentPct((Number(e.target.value) || 0) / 100)
            }
            className="block w-full rounded-md border bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>
      </div>

      <dl className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
        <Row label="Enganche" value={fmt(downPayment)} />
        <Row label="Principal + interés" value={fmt(principalInterest)} />
        <Row
          label="Predial (mensual)"
          value={fmt(monthlyTaxes)}
        />
        <Row label="Mantenimiento (HOA)" value={fmt(monthlyHoa)} />
        <div className="border-t pt-2">
          <div className="flex items-center justify-between font-semibold">
            <dt>Pago mensual total</dt>
            <dd className="text-base text-primary">{fmt(totalMonthly)}</dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
