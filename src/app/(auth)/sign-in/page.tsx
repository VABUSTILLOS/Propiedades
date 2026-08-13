import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { Em } from "@/components/layout/emphasis";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function SignInPage() {
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
        <h1 className="text-xl font-semibold tracking-tight">Hola <Em>de nuevo</Em></h1>
        <p className="text-sm text-muted-foreground">
          Inicia sesión para administrar tus listados y consultas.
        </p>
      </div>
      <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
