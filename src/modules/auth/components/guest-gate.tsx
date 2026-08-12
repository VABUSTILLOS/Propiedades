import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

type GuestGateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  next?: string;
  actionLabel?: string;
};

/**
 * Demo/CTA state shown to anonymous visitors on personal pages. Explains what
 * the feature does and invites them to create an account (or sign in) to
 * unlock it, keeping the redirect target so they land back where they were.
 */
export function GuestGate({
  icon: Icon = Sparkles,
  title,
  description,
  next = "/",
  actionLabel = "Crear cuenta",
}: GuestGateProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </span>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/sign-up?next=${encodeURIComponent(next)}`}
          className={buttonVariants()}
        >
          {actionLabel}
        </Link>
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Iniciar sesión
        </Link>
      </div>
      <Link
        href="/search"
        className={buttonVariants({ variant: "ghost" })}
      >
        Explorar propiedades
      </Link>
    </div>
  );
}
