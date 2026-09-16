import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";
import { Em } from "@/components/layout/emphasis";

export const metadata: Metadata = {
  title: "Restablece tu contraseña",
  description: "Te enviamos un enlace para elegir una nueva contraseña.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Propiedades
        </Link>
        <div>
          <span className="inline-flex items-center rounded-full border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
            Tu cuenta
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          ¿Olvidaste tu <Em>contraseña</Em>?
        </h1>
        <p className="text-sm text-muted-foreground">
          Escribe tu correo y te enviamos un enlace para elegir una nueva.
        </p>
      </div>
      <Suspense
        fallback={
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
        }
      >
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
