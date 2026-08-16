import { Badge } from "@/components/ui/badge";
import type { PropertyDealType } from "@/modules/lib/database.types";
import { dealTypeLabel } from "@/modules/lib/real-estate";

const DEAL_TYPE_CLASSES: Record<PropertyDealType, string> = {
  venta_directa: "bg-slate-600",
  remate_bancario: "bg-emerald-600",
  flipping: "bg-amber-600",
  traspaso: "bg-sky-600",
  renta: "bg-violet-600",
};

export const DEAL_TYPE_BADGES: Record<PropertyDealType, { label: string; className: string }> =
  Object.fromEntries(
    (Object.keys(DEAL_TYPE_CLASSES) as PropertyDealType[]).map((dealType) => [
      dealType,
      { label: dealTypeLabel(dealType), className: DEAL_TYPE_CLASSES[dealType] },
    ]),
  );

export const DEAL_THRESHOLD_PCT = 25;

/** Badge that labels the deal type (remate/flipping/traspaso/venta directa). */
export function DealTypeBadge({ dealType }: { dealType: PropertyDealType }) {
  const badge = DEAL_TYPE_BADGES[dealType] ?? DEAL_TYPE_BADGES.venta_directa;
  return <Badge className={badge.className}>{badge.label}</Badge>;
}

/** Financial fields required to render per-deal-type investment KPIs. */
export type InvestmentKpisData = {
  dealType: PropertyDealType;
  price: number;
  costoReparacion: number | null;
  valorPostReparacion: number | null;
  institucionBancaria: string | null;
  fechaRemate: string | null;
  condicionesTraspaso: string | null;
  capRate: number | null;
  rentaEstimada: number | null;
  discountAvaluo: number | null;
};

/**
 * Per-deal-type financial KPIs: remate → avalúo/institution/date;
 * flipping → repair cost + ARV + projected profit; traspaso → terms;
 * comercial/terreno → cap-rate and estimated rent.
 */
export function InvestmentKpis({ item }: { item: InvestmentKpisData }) {
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
