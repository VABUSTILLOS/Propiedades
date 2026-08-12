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
    <footer className="border-t bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-foreground)]">
                <Building2 className="size-4" />
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
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Propiedades. Hecho en México.
        </div>
      </div>
    </footer>
  );
}
