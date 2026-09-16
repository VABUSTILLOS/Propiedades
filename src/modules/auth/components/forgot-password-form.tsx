"use client";

import { useActionState } from "react";
import Link from "next/link";

import { sendPasswordReset } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Requests a recovery email. The action reports success even for unknown
 * addresses, so the confirmation stays deliberately neutral.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(sendPasswordReset, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground" role="status">
          Si esa dirección tiene una cuenta, te enviamos un enlace para
          restablecer tu contraseña. Revisa tu correo y la carpeta de spam.
        </p>
        <Link
          href="/sign-in"
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@ejemplo.com"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace de restablecimiento"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Recordaste tu contraseña?{" "}
        <Link href="/sign-in" className="font-medium underline underline-offset-4">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
