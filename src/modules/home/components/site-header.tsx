import Link from "next/link";
import { Building2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { AuthUser } from "@/modules/auth/session";

const NAV_LINKS = [
  { href: "/search", label: "Comprar" },
  { href: "/investor", label: "Invertir" },
  { href: "/fsbo", label: "Vender" },
  { href: "/preapproval", label: "Preaprobación" },
];

/**
 * Sticky marketplace header shown on the homepage. Renders the brand,
 * primary navigation and session-aware auth actions.
 */
export function SiteHeader({ user }: { user: AuthUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-foreground)]">
            <Building2 className="size-4" />
          </span>
          <span className="text-lg font-bold tracking-tight">Propiedades</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/dashboard"
              className={buttonVariants({ className: "hidden sm:inline-flex" })}
            >
              Mi panel
            </Link>
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
