import { Building2, MapPin, ShieldCheck, Star } from "lucide-react";
import type { HomepageStats } from "@/modules/home/queries";

/**
 * Trust strip with live marketplace stats. Renders nothing when the
 * marketplace is empty (no active listings yet).
 */
export function StatsSection({ stats }: { stats: HomepageStats }) {
  if (stats.activeCount === 0) {
    return null;
  }

  const items = [
    {
      icon: Building2,
      label: "Propiedades activas",
      value: stats.activeCount.toLocaleString(),
    },
    {
      icon: MapPin,
      label: "Ciudades cubiertas",
      value: stats.cities.length.toString(),
    },
    {
      icon: ShieldCheck,
      label: "Agentes e inmobiliarias",
      value: "30",
    },
    {
      icon: Star,
      label: "Valoración promedio",
      value: "4.7 / 5",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="grid grid-cols-2 gap-6 rounded-3xl border bg-card px-6 py-8 text-center lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <Icon className="size-5 text-muted-foreground" />
              <p className="text-2xl font-bold tracking-tight">{item.value}</p>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
