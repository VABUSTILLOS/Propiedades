"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signUp } from "@/modules/auth/actions";
import type { ActionResult } from "@/modules/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: ActionResult = { ok: true, data: undefined };

const ROLES = [
  { value: "buyer", label: "Comprador" },
  { value: "investor", label: "Inversionista" },
  { value: "agent", label: "Agente / Profesional inmobiliario" },
  { value: "owner_fsbo", label: "Dueño (FSBO)" },
] as const;

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {!state.ok && (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input id="fullName" name="fullName" required placeholder="María García" />
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Al menos 8 caracteres"
        />
      </div>

      <div className="space-y-2">
        <Label>Soy…</Label>
        <Select name="role" defaultValue="buyer">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona un rol" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/sign-in" className="font-medium underline underline-offset-4">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
