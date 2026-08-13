import Link from "next/link";
import { Building2 } from "lucide-react";

const FOOTER_COLUMNS = [
  {
    heading: "Explorar",
    links: [
      { href: "/search", label: "Todas las propiedades" },
      { href: "/search?type=sale", label: "Comprar" },
      { href: "/rentas", label: "Rentar" },
      { href: "/investor", label: "Modo inversionista" },
    ],
  },
  {
    heading: "Herramientas",
    links: [
      { href: "/preapproval", label: "Preaprobación crediticia" },
      { href: "/compare", label: "Comparar propiedades" },
      { href: "/favorites", label: "Mis favoritos" },
      { href: "/fsbo", label: "Módulo FSBO" },
    ],
  },
  {
    heading: "Cuenta",
    links: [
      { href: "/sign-in", label: "Iniciar sesión" },
      { href: "/sign-up", label: "Crear cuenta" },
      { href: "/dashboard", label: "Mi panel" },
    ],
  },
];

/**
 * Marketplace footer in the registry language: dark ink band, mono column
 * headings and a live status line. Rendered from the root layout, so every
 * page of the site closes with the same signature as the homepage.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink text-ink-foreground">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-copper to-copper-deep text-white shadow-sm">
                <Building2 className="size-[18px]" />
              </span>
              <span className="text-lg font-bold tracking-tight">
                Propiedades
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-white/70">
              El registro de oportunidades inmobiliarias de México: solo las
              que superan al mercado, con los números a la vista.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-white/65">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-live" />
              </span>
              Registro activo · Hecho en México
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.28em] text-white/65">
                {column.heading}
              </h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/65 transition-colors hover:text-copper-bright"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-white/10 pt-6 font-mono text-xs text-white/65 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Propiedades</span>
          <span className="uppercase tracking-[0.18em]">
            Compra · Renta · Invierte · Vende
          </span>
        </div>
      </div>
    </footer>
  );
}
