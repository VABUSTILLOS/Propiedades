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
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-copper to-copper-deep text-white shadow-sm">
            <Building2 className="size-[18px]" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight min-[360px]:inline">
            Propiedades
          </span>
        </Link>

        <DesktopNav />

        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <>
              <span className="hidden sm:inline-flex">
                <Link href="/fsbo" className={buttonVariants()}>
                  Publicar
                </Link>
              </span>
              <span className="hidden sm:inline-flex">
                <Link
                  href="/dashboard"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Mi panel
                </Link>
              </span>
              <span className="hidden sm:inline-flex">
                <SignOutButton />
              </span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline-flex">
                <Link
                  href="/sign-in"
                  className={buttonVariants({ variant: "ghost" })}
                >
                  Entrar
                </Link>
              </span>
              <span className="hidden sm:inline-flex">
                <Link href="/sign-up" className={buttonVariants()}>
                  Crear cuenta
                </Link>
              </span>
            </>
          )}
          <MobileNav user={user !== null} />
        </div>
      </div>
    </header>
  );
}
