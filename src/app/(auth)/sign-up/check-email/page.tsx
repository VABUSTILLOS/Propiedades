import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Revisa tu correo" };

/**
 * Post-sign-up confirmation screen. `signUp()` redirects here when email
 * confirmation is enabled and no session was returned yet.
 */
export default function CheckEmailPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <span className="inline-flex items-center rounded-full border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
          Tu cuenta
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Revisa tu correo</h1>
        <p className="text-sm text-muted-foreground">
          Te enviamos un enlace de confirmación. Haz clic en él para activar tu
          cuenta y luego inicia sesión para empezar.
        </p>
      </div>
      <Link href="/sign-in" className={buttonVariants({ className: "w-full" })}>
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
