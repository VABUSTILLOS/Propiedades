import Link from "next/link";
import { Building2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { AuthUser } from "@/modules/auth/session";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { DesktopNav, MobileNav } from "@/modules/home/components/site-nav";
import { ThemeToggle } from "@/modules/home/components/theme-toggle";

/**
 * Sticky marketplace header shown on the homepage. Renders the brand,
 * primary navigation and session-aware auth actions.
 */
export function SiteHeader({ user }: { user: AuthUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-copper to-copper-deep text-white shadow-sm">
            <Building2 className="size-[18px]" />
          </span>
          <span className="text-lg font-bold tracking-tight">Propiedades</span>
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
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
              <SignOutButton />
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
          <MobileNav user={user !== null} />
        </div>
      </div>
    </header>
  );
}
