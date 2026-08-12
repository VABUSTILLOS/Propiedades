import Link from "next/link";
import { Building2 } from "lucide-react";

const FOOTER_COLUMNS = [
  {
    heading: "Explorar",
    links: [
      { href: "/search", label: "Todas las propiedades" },
      { href: "/search?type=sale", label: "Comprar" },
      { href: "/search?type=rent", label: "Rentar" },
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
 * Marketplace footer with brand block and link columns.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#C97B4A] to-[#8F3E22] text-white shadow-sm">
                <Building2 className="size-[18px]" />
              </span>
              <span className="text-lg font-bold tracking-tight">
                Propiedades
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              El marketplace inmobiliario de México para comprar, rentar,
              invertir y vender con datos y procesos claros.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="mb-3 text-sm font-semibold">{column.heading}</h3>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border/70 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Propiedades. Hecho en México.</span>
          <span className="text-xs">
            Compra · Renta · Invierte · Vende
          </span>
        </div>
      </div>
    </footer>
  );
}
