import Link from "next/link";

import { Building2, Home, TrendingUp, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { CityStat } from "@/modules/home/queries";

const EXPLORE_OPTIONS = [
  {
    href: "/search?type=sale",
    icon: Home,
    title: "Comprar",
    description: "Casas y departamentos entre particulares, con valuación y $/m².",
  },
  {
    href: "/rentas",
    icon: Building2,
    title: "Rentar",
    description: "Renta con tours agendables y comunicación directa con el dueño.",
  },
  {
    href: "/investor",
    icon: TrendingUp,
    title: "Invertir",
    description: "Remates bancarios, flipping, traspasos, locales, bodegas y terrenos con cap rate y descuento sobre avalúo.",
  },
];

/**
 * "Explora" section: entry points by intent plus city tiles with
 * live listing counts. Falls back gracefully when there are no cities.
 */
export function ExploreSection({ cities }: { cities: CityStat[] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Explora el mercado inmobiliario
          </h2>
          <p className="mt-1 text-muted-foreground">
            Compra, renta o invierte con datos reales y procesos claros.
          </p>
        </div>
        <Link
          href="/search"
          className={buttonVariants({ variant: "ghost" })}
        >
          Ver todas las propiedades
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {EXPLORE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Link
              key={option.href}
              href={option.href}
              className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D67E3C] to-[#A83810] text-white shadow-sm">
                <Icon className="size-5" />
              </span>
              <h3 className="font-semibold group-hover:underline">
                {option.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {option.description}
              </p>
            </Link>
          );
        })}
      </div>

      {cities.length > 0 && (
        <div className="mt-12">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <MapPin className="size-4 text-muted-foreground" />
            Busca por ciudad
          </h3>
          <div className="flex flex-wrap gap-3">
            {cities.map((city) => (
              <Link
                key={city.name}
                href={`/search?city=${encodeURIComponent(city.name)}`}
                className="rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-foreground"
              >
                {city.name}
                <span className="ml-1.5 text-muted-foreground">
                  · {city.count} {city.count === 1 ? "propiedad" : "propiedades"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
