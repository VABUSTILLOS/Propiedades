"use client";

/**
 * MortgageCalculator — Simulador de crédito hipotecario para el detalle de
 * propiedad (mercado México). Es la ÚNICA calculadora de la publicación:
 * vive en la vista Residencia (ancla #simulador) y el sidebar enlaza a ella.
 *
 * Matemática:
 *  - Pago mensual: sistema de amortización francesa (cuota constante)
 *      M = P * r(1+r)^n / ((1+r)^n - 1)   +  P * 0.0015  (seguro vida+daños)
 *    donde r = tasa anual / 12  y  n = plazo en años * 12.
 *  - Pago total: M + predial mensual + mantenimiento (HOA) cuando el inmueble
 *    trae esos datos, para que la mensualidad mostrada sea la real del bolsillo.
 *  - Capital inicial en caja:
 *      enganche + notaría (6% del precio) + avalúo/apertura (1.5% del precio)
 *      menos el saldo de Subcuenta de Vivienda (Cofinavit) si aplica.
 *  - Ingreso mínimo sugerido: pago total / 0.30 (relación pago/ingreso).
 *
 * Conversión: micro-textos de confianza + captura de lead por formulario
 * (server action `captureMortgageLead`, tabla mortgage_leads) o directo por
 * WhatsApp con la simulación pre-llenada.
 */

import * as React from "react";
import {
  BadgeCheck,
  Calculator,
  CalendarClock,
  ChevronDown,
  Handshake,
  Landmark,
  Loader2,
  Percent,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMxn } from "@/modules/lib/real-estate";
import { captureMortgageLead } from "@/modules/listings/actions";
import { WHATSAPP_CONTACT_NUMBER } from "@/modules/chat/share";
import { WhatsAppIcon } from "@/modules/chat/components/share-whatsapp-button";

// ---------------------------------------------------------------------------
// Constantes del modelo financiero
// ---------------------------------------------------------------------------

/** Tasa de interés anual fija por defecto (promedio banca MX 2026). */
const DEFAULT_ANNUAL_RATE = 10.5;
/** Seguro de vida y daños estimado: 0.15% mensual sobre el saldo del crédito. */
const INSURANCE_MONTHLY_RATE = 0.0015;
/** Gastos notariales / escrituración: 6% del precio de venta. */
const NOTARY_RATE = 0.06;
/** Avalúo + comisión por apertura: 1.5% del precio de venta. */
const OPENING_RATE = 0.015;
/** Relación pago/ingreso máxima sugerida por la banca (30%). */
const PAYMENT_TO_INCOME = 0.3;

const DOWN_PAYMENT_MIN = 10;
const DOWN_PAYMENT_MAX = 50;
const DOWN_PAYMENT_DEFAULT = 20;
const TERM_OPTIONS = [10, 15, 20] as const;
/** Estimación típica del saldo de Subcuenta de Vivienda (editable). */
const DEFAULT_INFONAVIT_AMOUNT = 80_000;

// ---------------------------------------------------------------------------
// Helpers puros (testeables)
// ---------------------------------------------------------------------------

/**
 * Pago mensual por sistema francés (cuota fija) + seguro sobre saldo.
 * Si la tasa es 0 (caso borde), la cuota es simplemente P / n.
 */
export function calcMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termYears: number,
): number {
  const n = termYears * 12;
  if (principal <= 0 || n <= 0) return 0;

  const r = annualRatePercent / 100 / 12;
  const base =
    r === 0
      ? principal / n
      : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  // Seguro de vida y daños: 0.15% mensual del monto financiado.
  return base + principal * INSURANCE_MONTHLY_RATE;
}

/** Desglose del capital inicial requerido en caja. */
export function calcUpfrontCash(
  propertyPrice: number,
  downPaymentAmount: number,
  infonavitAmount: number,
): {
  downPayment: number;
  notary: number;
  opening: number;
  infonavitCredit: number;
  total: number;
} {
  const notary = propertyPrice * NOTARY_RATE;
  const opening = propertyPrice * OPENING_RATE;
  // La subcuenta nunca puede reducir el total por debajo de notaría + apertura.
  const infonavitCredit = Math.min(Math.max(infonavitAmount, 0), downPaymentAmount);
  return {
    downPayment: downPaymentAmount,
    notary,
    opening,
    infonavitCredit,
    total: downPaymentAmount + notary + opening - infonavitCredit,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Props públicas
// ---------------------------------------------------------------------------

export type MortgageCalculatorProps = {
  propertyId: string;
  propertyTitle: string;
  /** Precio de venta en MXN. */
  propertyPrice: number;
  /** Predial anual del inmueble (MXN) — se prorratea a la mensualidad. */
  predialAnual?: number | null;
  /** Cuota mensual de mantenimiento / HOA (MXN). */
  hoaFee?: number | null;
  /** Tasa anual configurable (default 10.5%). */
  defaultAnnualRate?: number;
  /** Monto default de subcuenta Infonavit (default $80,000). */
  defaultInfonavitAmount?: number;
  className?: string;
};

export function MortgageCalculator({
  propertyId,
  propertyTitle,
  propertyPrice,
  predialAnual,
  hoaFee,
  defaultAnnualRate = DEFAULT_ANNUAL_RATE,
  defaultInfonavitAmount = DEFAULT_INFONAVIT_AMOUNT,
  className,
}: MortgageCalculatorProps) {
  // --- Estado de la simulación ---------------------------------------------
  const [downPaymentPercent, setDownPaymentPercent] = React.useState(
    DOWN_PAYMENT_DEFAULT,
  );
  const [termYears, setTermYears] = React.useState<number>(20);
  const [annualRate, setAnnualRate] = React.useState(defaultAnnualRate);
  const [hasInfonavit, setHasInfonavit] = React.useState(false);
  const [infonavitAmount, setInfonavitAmount] = React.useState(
    defaultInfonavitAmount,
  );

  // --- Cálculos derivados (tiempo real) -------------------------------------
  const downPaymentAmount = Math.round(
    (propertyPrice * downPaymentPercent) / 100,
  );
  const principal = propertyPrice - downPaymentAmount;

  const monthlyPayment = React.useMemo(
    () => calcMonthlyPayment(principal, annualRate, termYears),
    [principal, annualRate, termYears],
  );

  // Costos de tenencia del inmueble prorrateados al mes.
  const monthlyPredial = Math.max(0, (predialAnual ?? 0) / 12);
  const monthlyHoa = Math.max(0, hoaFee ?? 0);
  const hasExtras = monthlyPredial > 0 || monthlyHoa > 0;
  const totalMonthlyPayment = monthlyPayment + monthlyPredial + monthlyHoa;

  const upfront = React.useMemo(
    () =>
      calcUpfrontCash(
        propertyPrice,
        downPaymentAmount,
        hasInfonavit ? infonavitAmount : 0,
      ),
    [propertyPrice, downPaymentAmount, hasInfonavit, infonavitAmount],
  );

  const minIncome = totalMonthlyPayment / PAYMENT_TO_INCOME;

  // Sincronización enganche % ↔ $ (ambos editables, con clamping).
  const handlePercentChange = (pct: number) => {
    setDownPaymentPercent(
      clamp(Math.round(pct), DOWN_PAYMENT_MIN, DOWN_PAYMENT_MAX),
    );
  };
  const handleAmountChange = (amount: number) => {
    if (propertyPrice <= 0) return;
    handlePercentChange((amount / propertyPrice) * 100);
  };

  return (
    <Card className={cn("rounded-2xl shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-4 text-primary" aria-hidden="true" />
          Simulador de crédito
        </CardTitle>
        <CardDescription>
          Calcula cuánto pagarías al mes y el capital inicial en segundos.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Pago mensual destacado (hipoteca + predial + mantenimiento) */}
        <div className="rounded-xl bg-primary/5 px-4 py-3 text-center ring-1 ring-inset ring-primary/10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pago mensual total estimado
          </p>
          <p
            className="mt-1 text-3xl font-bold tabular-nums tracking-tight"
            aria-live="polite"
          >
            {formatMxn(Math.round(totalMonthlyPayment))}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / mes
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crédito de {formatMxn(principal)} · {annualRate.toFixed(2)}% anual ·{" "}
            {termYears} años
          </p>
          {hasExtras && (
            <dl className="mt-3 space-y-1 border-t border-primary/10 pt-2 text-left text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Hipoteca (crédito + seguro)</dt>
                <dd className="font-medium tabular-nums">
                  {formatMxn(Math.round(monthlyPayment))}
                </dd>
              </div>
              {monthlyPredial > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Predial</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMxn(Math.round(monthlyPredial))}
                  </dd>
                </div>
              )}
              {monthlyHoa > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Mantenimiento (HOA)</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMxn(Math.round(monthlyHoa))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Enganche: slider + % + $ sincronizados */}
        <SliderField
          icon={Percent}
          label="Enganche"
          value={downPaymentPercent}
          min={DOWN_PAYMENT_MIN}
          max={DOWN_PAYMENT_MAX}
          step={1}
          onChange={handlePercentChange}
          displayValue={`${downPaymentPercent}%`}
          secondaryInput={{
            value: downPaymentAmount,
            onChange: handleAmountChange,
            prefix: "$",
            ariaLabel: "Enganche en pesos",
          }}
        />

        {/* Plazo: botones segmentados */}
        <div className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
            Plazo del crédito
          </span>
          <div
            className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1"
            role="group"
            aria-label="Plazo del crédito en años"
          >
            {TERM_OPTIONS.map((years) => (
              <button
                key={years}
                type="button"
                onClick={() => setTermYears(years)}
                aria-pressed={termYears === years}
                className={cn(
                  "min-h-11 rounded-full text-sm font-medium transition-colors",
                  termYears === years
                    ? "bg-background shadow-sm ring-1 ring-foreground/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {years} años
              </button>
            ))}
          </div>
        </div>

        {/* Tasa anual configurable */}
        <SliderField
          icon={Percent}
          label="Tasa de interés anual"
          value={annualRate}
          min={5}
          max={18}
          step={0.25}
          onChange={(v) => setAnnualRate(clamp(v, 5, 18))}
          displayValue={`${annualRate.toFixed(2)}%`}
        />

        {/* Cofinavit / Subcuenta de Vivienda */}
        <div className="space-y-3 rounded-xl border p-3">
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
              Sumar Cofinavit / Subcuenta
            </span>
            <input
              type="checkbox"
              checked={hasInfonavit}
              onChange={(e) => setHasInfonavit(e.target.checked)}
              className="size-5 shrink-0 accent-primary"
              aria-label="Incluir saldo de Subcuenta de Vivienda (Cofinavit)"
            />
          </label>
          {hasInfonavit && (
            <div className="space-y-1">
              <Label htmlFor="infonavit-amount" className="text-xs">
                Saldo de Subcuenta de Vivienda
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="infonavit-amount"
                  type="number"
                  min={0}
                  step={1000}
                  value={infonavitAmount}
                  onChange={(e) =>
                    setInfonavitAmount(
                      Math.max(0, Number(e.target.value) || 0),
                    )
                  }
                  className="h-9 pl-6 tabular-nums"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Se descuenta del enganche que pagas de tu bolsa.
              </p>
            </div>
          )}
        </div>

        {/* Desglose del capital inicial + ingreso mínimo */}
        <UpfrontBreakdown
          upfront={upfront}
          minIncome={minIncome}
          hasInfonavit={hasInfonavit}
        />

        {/* Micro-textos de confianza: bajan la fricción justo antes del lead */}
        <TrustSignals />

        {/* Captura de lead + CTA directo a WhatsApp */}
        <LeadCaptureForm
          propertyId={propertyId}
          propertyTitle={propertyTitle}
          propertyPrice={propertyPrice}
          monthlyPayment={monthlyPayment}
          totalMonthlyPayment={totalMonthlyPayment}
          downPaymentAmount={downPaymentAmount}
          simulation={{
            downPaymentPercent,
            termYears,
            annualInterestRate: annualRate,
            hasInfonavit,
            infonavitAmount: hasInfonavit ? infonavitAmount : 0,
          }}
        />

        <p className="text-center text-[11px] leading-snug text-muted-foreground">
          Simulación con fines ilustrativos. Las condiciones finales dependen de
          la evaluación crediticia de cada institución.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Micro-textos de confianza
// ---------------------------------------------------------------------------

function TrustSignals() {
  return (
    <ul className="space-y-2 rounded-xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
      <li className="flex items-start gap-2">
        <Handshake
          className="mt-0.5 size-3.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>
          <strong className="font-medium text-foreground">
            Asesoría 100% gratuita
          </strong>{" "}
          — comparar no te cuesta nada.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Landmark
          className="mt-0.5 size-3.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>
          Comparamos{" "}
          <strong className="font-medium text-foreground">
            Santander, Scotiabank, Banregio, HSBC y más
          </strong>
          .
        </span>
      </li>
      <li className="flex items-start gap-2">
        <ShieldCheck
          className="mt-0.5 size-3.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>
          <strong className="font-medium text-foreground">
            Tu buró no se ve afectado
          </strong>{" "}
          por simular.
        </span>
      </li>
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Slider + campo numérico sincronizado
// ---------------------------------------------------------------------------

type SliderFieldProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  displayValue: string;
  secondaryInput?: {
    value: number;
    onChange: (value: number) => void;
    prefix?: string;
    ariaLabel: string;
  };
};

function SliderField({
  icon: Icon,
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
  secondaryInput,
}: SliderFieldProps) {
  const id = React.useId();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">
            {displayValue}
          </span>
          {secondaryInput && (
            <div className="relative w-28">
              {secondaryInput.prefix && (
                <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-muted-foreground">
                  {secondaryInput.prefix}
                </span>
              )}
              <Input
                type="number"
                min={0}
                value={secondaryInput.value}
                onChange={(e) =>
                  secondaryInput.onChange(Number(e.target.value) || 0)
                }
                aria-label={secondaryInput.ariaLabel}
                className={cn(
                  "h-7 text-xs tabular-nums",
                  secondaryInput.prefix && "pl-5",
                )}
              />
            </div>
          )}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
        aria-valuetext={displayValue}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acordeón del capital inicial + ingreso mínimo
// ---------------------------------------------------------------------------

function UpfrontBreakdown({
  upfront,
  minIncome,
  hasInfonavit,
}: {
  upfront: ReturnType<typeof calcUpfrontCash>;
  minIncome: number;
  hasInfonavit: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const contentId = React.useId();

  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      >
        <span className="text-sm">
          <span className="block text-xs text-muted-foreground">
            Capital inicial requerido
          </span>
          <span className="font-semibold tabular-nums">
            {formatMxn(Math.round(upfront.total))}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={contentId}
        hidden={!open}
        className="border-t px-3 py-3"
      >
        <dl className="space-y-1.5 text-sm">
          <BreakdownRow
            label={`Enganche`}
            value={formatMxn(Math.round(upfront.downPayment))}
          />
          <BreakdownRow
            label="Gastos notariales (6%)"
            value={formatMxn(Math.round(upfront.notary))}
          />
          <BreakdownRow
            label="Avalúo y apertura (1.5%)"
            value={formatMxn(Math.round(upfront.opening))}
          />
          {hasInfonavit && upfront.infonavitCredit > 0 && (
            <BreakdownRow
              label="− Subcuenta de Vivienda"
              value={`− ${formatMxn(Math.round(upfront.infonavitCredit))}`}
              valueClassName="text-emerald-600 dark:text-emerald-400"
            />
          )}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
            <dt>Total en caja</dt>
            <dd className="tabular-nums">
              {formatMxn(Math.round(upfront.total))}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs">
          <ShieldCheck
            className="mt-0.5 size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p>
            Ingreso mensual mínimo sugerido:{" "}
            <strong className="tabular-nums">
              {formatMxn(Math.round(minIncome))}
            </strong>{" "}
            (la banca pide que la mensualidad no supere el 30% de tu ingreso).
          </p>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium tabular-nums", valueClassName)}>{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulario de captura de lead + CTA de WhatsApp
// ---------------------------------------------------------------------------

type LeadFormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

function LeadCaptureForm({
  propertyId,
  propertyTitle,
  propertyPrice,
  monthlyPayment,
  totalMonthlyPayment,
  downPaymentAmount,
  simulation,
}: {
  propertyId: string;
  propertyTitle: string;
  propertyPrice: number;
  monthlyPayment: number;
  totalMonthlyPayment: number;
  downPaymentAmount: number;
  simulation: {
    downPaymentPercent: number;
    termYears: number;
    annualInterestRate: number;
    hasInfonavit: boolean;
    infonavitAmount: number;
  };
}) {
  const [state, setState] = React.useState<LeadFormState>({ status: "idle" });
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");

  // CTA directo a WhatsApp: el asesor recibe la simulación ya armada.
  const whatsAppMessage =
    `Hola 👋 simulé un crédito para "${propertyTitle}" (${formatMxn(propertyPrice)}): ` +
    `mensualidad estimada de ${formatMxn(Math.round(totalMonthlyPayment))} al mes ` +
    `con enganche de ${formatMxn(downPaymentAmount)} a ${simulation.termYears} años. ` +
    `Quiero comparar créditos hipotecarios y descubrir cuál me conviene más.`;
  const whatsAppHref = `https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${encodeURIComponent(
    whatsAppMessage,
  )}`;

  const fieldError = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "submitting" });

    // Payload: datos del lead + metadatos del cálculo para seguimiento CRM.
    const result = await captureMortgageLead({
      fullName,
      phone,
      email,
      propertyId,
      propertyTitle,
      propertyPrice,
      simulatedMonthlyPayment: Math.round(monthlyPayment),
      simulatedDownPayment: Math.round(downPaymentAmount),
      simulation,
    });

    if (result.ok) {
      setState({ status: "success" });
    } else {
      setState({
        status: "error",
        message: result.error,
        fieldErrors: result.fieldErrors,
      });
    }
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-6 text-center">
        <BadgeCheck className="size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="text-sm font-semibold">¡Solicitud recibida!</p>
        <p className="text-xs text-muted-foreground">
          Un asesor hipotecario te contactará en menos de 24 horas con la
          comparativa de créditos que mejor te convenga — sin costo.
        </p>
      </div>
    );
  }

  const submitting = state.status === "submitting";

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <p className="text-sm font-semibold">
          Descubre cuál crédito hipotecario te conviene más
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Compara y llévate el mejor para ti. Déjanos tu WhatsApp y un asesor
          te contacta hoy mismo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div className="space-y-1">
          <Label htmlFor="lead-name" className="text-xs">
            Nombre completo
          </Label>
          <Input
            id="lead-name"
            name="fullName"
            autoComplete="name"
            required
            minLength={3}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={Boolean(fieldError("fullName"))}
            className="h-9"
          />
          {fieldError("fullName") && (
            <p className="text-xs text-destructive">{fieldError("fullName")}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="lead-phone" className="text-xs">
            Teléfono / WhatsApp
          </Label>
          <Input
            id="lead-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="614 000 0000"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(fieldError("phone"))}
            className="h-9"
          />
          {fieldError("phone") && (
            <p className="text-xs text-destructive">{fieldError("phone")}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="lead-email" className="text-xs">
            Correo electrónico
          </Label>
          <Input
            id="lead-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldError("email"))}
            className="h-9"
          />
          {fieldError("email") && (
            <p className="text-xs text-destructive">{fieldError("email")}</p>
          )}
        </div>

        {state.status === "error" && !state.fieldErrors && (
          <p className="text-xs text-destructive" role="alert">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="min-h-11 w-full">
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : (
            "Comparar créditos gratis — asesoría en 24h"
          )}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        o directo por
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <a
        href={whatsAppHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1EBE5A]"
      >
        <WhatsAppIcon className="size-4" />
        Descubrir mi mejor crédito por WhatsApp
      </a>
    </div>
  );
}
