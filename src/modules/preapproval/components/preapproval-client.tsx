"use client";

import { useState } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";

import { submitPreapproval } from "@/modules/preapproval/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SavedPreapproval = {
  infonavit_nss: string | null;
  max_credit: number;
  bank_preapproved: boolean;
  bank_name: string | null;
  calculated_at: string | null;
};

type Props = {
  saved: SavedPreapproval;
};

type Result = {
  infonavit_nss: string | null;
  max_credit: number;
  bank_preapproved: boolean;
  bank_name: string | null;
  monthly_payment_estimate: number;
  persisted: boolean;
  matches: Array<{
    id: string;
    slug: string;
    title: string;
    city: string;
    colonia: string;
    price: number;
    currency: string;
    image: string | null;
    monthly_payment: number;
  }>;
};

export function PreapprovalClient({ saved }: Props) {
  const [nss, setNss] = useState(saved.infonavit_nss ?? "");
  const [dob, setDob] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [bankName, setBankName] = useState(saved.bank_name ?? "");
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setError(null);
    const res = await submitPreapproval({
      infonavit_nss: nss.trim() || null,
      bank_preapproved: Boolean(bankName.trim()),
      bank_name: bankName.trim() || null,
      monthlyIncome: Number(monthlyIncome) || 0,
    });
    if (!res.ok) {
      setState("error");
      setError(res.error);
      return;
    }
    setResult(res.data);
    setState("idle");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">NSS (Infonavit)</span>
              <input
                value={nss}
                onChange={(e) => setNss(e.target.value)}
                placeholder="Ej. 12345678901"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">
                Fecha de nacimiento
              </span>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">
                Ingreso mensual estimado (MXN)
              </span>
              <input
                type="number"
                min={0}
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="Ej. 40000"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">
                Banco (si ya tienes preaprobación)
              </span>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ej. BBVA, Santander…"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button disabled={state === "running"} onClick={() => void run()}>
            <Landmark className="size-4" />
            {state === "running" ? "Calculando…" : "Calcular mi preaprobación"}
          </Button>

          {saved.calculated_at && !result && (
            <p className="text-xs text-muted-foreground">
              Último cálculo: {new Date(saved.calculated_at).toLocaleString()} · Crédito
              máximo: ${saved.max_credit.toLocaleString()} MXN
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {!result.persisted && (
              <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Este resultado es una vista previa.{" "}
                <Link
                  href="/sign-up?next=/preapproval"
                  className="font-medium text-primary hover:underline"
                >
                  Crea una cuenta para guardar tu preaprobación
                </Link>{" "}
                y consultarla después.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Crédito máximo</p>
                <p className="mt-1 text-xl font-bold">
                  ${result.max_credit.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Pago mensual estimado</p>
                <p className="mt-1 text-xl font-bold">
                  ${result.monthly_payment_estimate.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Estatus</p>
                <p className="mt-1 text-xl font-bold">
                  {result.bank_preapproved ? "Preaprobado" : "Pendiente"}
                </p>
              </div>
            </div>

            <div>
              <h2 className="font-semibold">
                Propiedades que alcanzas ({result.matches.length})
              </h2>
              {result.matches.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No encontramos propiedades dentro de tu presupuesto. Prueba
                  ajustando tu ingreso mensual.
                </p>
              ) : (
                <ul className="mt-3 divide-y">
                  {result.matches.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image}
                          alt=""
                          className="size-14 rounded-md object-cover"
                        />
                      ) : (
                        <div className="size-14 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/property/${m.slug}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {m.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {m.colonia}, {m.city} · ${m.monthly_payment.toLocaleString()}
                          /mo
                        </p>
                      </div>
                      <p className="text-sm font-semibold">
                        ${m.price.toLocaleString()}{" "}
                        <span className="text-xs text-muted-foreground">
                          {m.currency}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
