import Link from "next/link";
import { Building2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { AuthUser } from "@/modules/auth/session";

const NAV_LINKS = [
  { href: "/rentas", label: "Rentar" },
  { href: "/search", label: "Comprar" },
  { href: "/investor", label: "Invertir" },
  { href: "/fsbo", label: "Vender" },
  { href: "/listados", label: "Listados" },
  { href: "/preapproval", label: "Preaprobación" },
];

/**
 * Sticky marketplace header shown on the homepage. Renders the brand,
 * primary navigation and session-aware auth actions.
 */
export function SiteHeader({ user }: { user: AuthUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#D67E3C] to-[#A83810] text-white shadow-sm">
            <Building2 className="size-[18px]" />
          </span>
          <span className="text-lg font-bold tracking-tight">Propiedades</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              <Link
                href="/fsbo"
                className={buttonVariants({
                  className: "hidden sm:inline-flex",
                })}
              >
                Publicar
              </Link>
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "outline" })}
              >
                Mi panel
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "ghost" })}
              >
                Entrar
              </Link>
              <Link href="/sign-up" className={buttonVariants()}>
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
