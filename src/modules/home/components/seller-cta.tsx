import Link from "next/link";

import { BadgePercent, Bell, CalendarClock, ScanSearch } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { AuthUser } from "@/modules/auth/session";
import { FolioLabel } from "@/modules/home/components/folio-label";

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
 * Dark "registry" band (replacing the old orange gradient) so the homepage
 * closes in the same language as the hero, the data-edge section and the
 * site-wide footer. Session-aware CTA: authenticated users go straight to
 * the FSBO module.
 */
export function SellerCtaSection({ user }: { user: AuthUser | null }) {
  const ctaHref = user ? "/fsbo" : "/sign-up";
  const ctaLabel = user ? "Publicar mi propiedad" : "Publicar gratis";

  return (
    <section className="relative overflow-hidden bg-[#180F08] text-[#FBF6F0]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(251,246,240,0.05) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <FolioLabel index="04" title="Para vendedores" light />
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Tu propiedad también puede entrar al{" "}
            <em className="font-display italic">registro</em>
          </h2>
          <p className="mt-4 max-w-lg text-white/60">
            Para dueños directos y agentes. Sin comisiones ocultas: tú defines
            el precio, las condiciones y el método de pago — y cada listado se
            publica con su análisis de mercado completo.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={ctaHref}
              className={buttonVariants({
                size: "lg",
                className: "bg-[#FBF6F0] text-[#180F08] hover:bg-white",
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
                  "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white",
              })}
            >
              Ver oportunidades
            </Link>
          </div>
        </div>

        <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
          {SELLER_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <li key={point.title} className="bg-[#180F08] p-5">
                <Icon className="size-5 text-[#D67E3C]" aria-hidden />
                <p className="mt-4 font-semibold">{point.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/55">
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
