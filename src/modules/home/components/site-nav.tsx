"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { href: "/rentas", label: "Rentar" },
  { href: "/search", label: "Comprar" },
  { href: "/investor", label: "Invertir" },
  { href: "/fsbo", label: "Vender" },
  { href: "/listados", label: "Listados" },
  { href: "/preapproval", label: "Preaprobación" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop nav with active-section indicator and aria-current. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="hidden items-center gap-1 md:flex">
      {NAV_LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.label}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobile navigation: hamburger that opens a right-side sheet with the main
 * links and the publish CTA — the only way to reach the sections below the
 * md breakpoint.
 */
export function MobileNav({ user }: { user: boolean }) {
  const pathname = usePathname();
  return (
    <Sheet>
      <SheetTrigger
        aria-label="Abrir menú de navegación"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "md:hidden",
        )}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0">
        <SheetHeader>
          <SheetTitle>Menú</SheetTitle>
        </SheetHeader>
        <nav aria-label="Navegación principal móvil" className="flex flex-col gap-1 px-4">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <SheetClose
                key={link.label}
                render={
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-xl px-4 text-base font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  />
                }
              >
                {link.label}
              </SheetClose>
            );
          })}
        </nav>
        {user && (
          <div className="mt-2 border-t border-border px-4 pt-4">
            <SheetClose
              render={
                <Link
                  href="/fsbo"
                  className={cn(buttonVariants(), "w-full justify-center")}
                />
              }
            >
              Publicar propiedad
            </SheetClose>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
