import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/modules/auth/components/sign-up-form";
import { Em } from "@/components/layout/emphasis";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
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
        <h1 className="text-xl font-semibold tracking-tight">Crea tu <Em>cuenta</Em></h1>
        <p className="text-sm text-muted-foreground">
          Compra, invierte, publica o vende — a tu manera.
        </p>
      </div>
      <SignUpForm />
    </div>
  );
}
