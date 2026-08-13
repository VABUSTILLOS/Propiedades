import Link from "next/link";

import { BadgePercent, Bell, CalendarClock, ScanSearch } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { AuthUser } from "@/modules/auth/session";

const SELLER_POINTS = [
  {
    icon: ScanSearch,
    title: "Valuación automática",
    description: "Avalúo estimado y precio sugerido por la IA al publicar.",
  },
  {
    icon: Bell,
    title: "Ofertas digitales 24/7",
    description: "Recibe ofertas y contraofertas con método de pago definido.",
  },
  {
    icon: CalendarClock,
    title: "Tours por WhatsApp",
    description: "Los interesados agendan visitas directo en tu agenda.",
  },
  {
    icon: BadgePercent,
    title: "Preaprobación integrada",
    description: "Filtra compradores que ya precalificaron para crédito.",
  },
];

/**
 * Seller/owner call-to-action band — the supply side of the marketplace.
 * Session-aware CTA: authenticated users go straight to the FSBO module.
 */
export function SellerCtaSection({ user }: { user: AuthUser | null }) {
  const ctaHref = user ? "/fsbo" : "/sign-up";
  const ctaLabel = user ? "Publicar mi propiedad" : "Publicar gratis";

  return (
    <section className="relative overflow-hidden bg-[#180F08] text-[#FBF6F0]">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-white/5 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Publica tu propiedad en minutos
          </h2>
          <p className="mt-2 max-w-lg text-white/75">
            Para dueños directos y agentes. Sin comisiones ocultas: tú defines
            el precio, las condiciones y el método de pago.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={ctaHref}
              className={buttonVariants({
                size: "lg",
                className:
                  "bg-[#FBF6F0] text-[#180F08] shadow-sm hover:bg-white",
              })}
            >
              {ctaLabel}
            </Link>
            <Link
              href="/search"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className:
                  "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white",
              })}
            >
              Ver propiedades
            </Link>
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {SELLER_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <li
                key={point.title}
                className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm"
              >
                <span className="mb-2 flex size-9 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="size-4" />
                </span>
                <p className="font-semibold">{point.title}</p>
                <p className="mt-0.5 text-sm text-white/70">
                  {point.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
