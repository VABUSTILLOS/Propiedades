"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createSupabaseBrowserClient } from "@/modules/lib/supabase/browser";
import { passwordSchema } from "@/modules/lib/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Password reset form. Exchanges the recovery `code` from the email link
 * (PKCE flow) for a session, then lets the user set a new password.
 */
export function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [status, setStatus] = useState<"exchanging" | "error" | "ready">(() =>
    code ? "exchanging" : "error",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(() =>
    code
      ? null
      : "Falta el token de restablecimiento. Solicita un nuevo enlace para restablecer tu contraseña.",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Exchange the recovery code for a session once on mount.
  useEffect(() => {
    if (!code) return;

    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          setStatus("error");
          setStatusMessage(
            exchangeError.message ??
              "El enlace de restablecimiento no es válido o caducó. Solicita uno nuevo.",
          );
          return;
        }
        setStatus("ready");
      });
  }, [code]);

  const submit = () =>
    startTransition(async () => {
      setError(null);

      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Contraseña no válida");
        return;
      }
      if (password !== confirm) {
        setError("Las contraseñas no coinciden.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Session is now the real user session; sign out so they log in fresh.
      await supabase.auth.signOut();
      router.push("/sign-in");
      router.refresh();
    });

  if (status === "exchanging") {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Verificando enlace de restablecimiento…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive" role="alert">
          {statusMessage}
        </p>
        <a
          href="/sign-in"
          className={buttonVariants({ className: "w-full" })}
        >
          Volver a iniciar sesión
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Al menos 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Repite tu contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || !password || !confirm}
        onClick={submit}
      >
        {isPending ? "Actualizando…" : "Actualizar contraseña"}
      </Button>
    </form>
  );
}
