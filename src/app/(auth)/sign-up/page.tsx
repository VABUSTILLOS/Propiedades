import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/modules/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Propiedades
        </Link>
        <h1 className="text-lg font-semibold">Crea tu cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Compra, invierte, publica o vende — a tu manera.
        </p>
      </div>
      <SignUpForm />
    </div>
  );
}
