import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { UpdatePasswordForm } from "@/modules/auth/components/update-password-form";

export const metadata: Metadata = {
  title: "Establece una nueva contraseña",
  description: "Elige una nueva contraseña para tu cuenta.",
};

export default function UpdatePasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Propiedades
        </Link>
        <h1 className="text-lg font-semibold">Establece una nueva contraseña</h1>
        <p className="text-sm text-muted-foreground">
          Elige una nueva contraseña para tu cuenta.
        </p>
      </div>
      <Suspense
        fallback={
          <p className="py-8 text-center text-sm text-muted-foreground">
            Verificando enlace de restablecimiento…
          </p>
        }
      >
        <UpdatePasswordForm />
      </Suspense>
    </div>
  );
}
