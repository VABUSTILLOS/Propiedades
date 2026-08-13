import type { MarketBenchmarksRow, PropertiesRow } from "@/modules/lib/database.types";

type Props = {
  property: PropertiesRow;
  benchmark: MarketBenchmarksRow | null;
};

/**
 * Market data panel: benchmark comps for the listing's colonia.
 *
 * La simulación de pago vive en `MortgageCalculator` (vista Residencia) para
 * que cada publicación tenga una sola calculadora — este panel se queda solo
 * con la referencia de mercado que le da contexto al precio.
 */
export function MarketPanel({ property, benchmark }: Props) {
  const constPerM2 =
    property.construccion_m2 > 0 ? property.price / property.construccion_m2 : 0;

  return (
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
