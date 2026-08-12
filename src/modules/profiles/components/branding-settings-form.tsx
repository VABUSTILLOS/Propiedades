"use client";

import { useState, useTransition } from "react";

import { updateBranding } from "@/modules/profiles/actions";
import { DEFAULT_BRANDING, type BrandingConfig } from "@/modules/profiles/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BrandingSettingsForm({
  initialSubdomain,
  initialBranding,
  canConfigure,
}: {
  initialSubdomain: string | null;
  initialBranding: BrandingConfig;
  canConfigure: boolean;
}) {
  const [subdomain, setSubdomain] = useState(initialSubdomain ?? "");
  const [branding, setBranding] = useState<BrandingConfig>({
    ...DEFAULT_BRANDING,
    ...initialBranding,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canConfigure) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Imagen de marca de agencia</CardTitle>
          <CardDescription>
            Solo los agentes y administradores pueden configurar la marca del
            portal.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await updateBranding({
        subdomain: subdomain || undefined,
        branding: { ...branding },
      });
      if (!res.ok) setError(res.error);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imagen de marca de agencia</CardTitle>
        <CardDescription>
          Reclama un subdominio (p. ej. <code>agencia</code> →
          agencia.tuportal.com) y define los colores de tu marca.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subdomain">Subdominio</Label>
          <div className="flex items-center gap-2">
            <Input
              id="subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="agencia"
              className="font-mono"
            />
            <span className="text-sm text-muted-foreground">
              .{process.env.NEXT_PUBLIC_SITE_URL ?? "tuportal.com"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_name">Nombre de la empresa</Label>
          <Input
            id="company_name"
            value={branding.company_name}
            onChange={(e) =>
              setBranding((b) => ({ ...b, company_name: e.target.value }))
            }
            placeholder="Agencia Inmobiliaria X"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary_color">Color principal</Label>
            <div className="flex items-center gap-2">
              <Input
                id="primary_color"
                type="color"
                value={branding.primary_color}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, primary_color: e.target.value }))
                }
                className="h-10 w-14 p-1"
              />
              <span className="font-mono text-sm">{branding.primary_color}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp_cta">WhatsApp CTA</Label>
            <Input
              id="whatsapp_cta"
              value={branding.whatsapp_cta}
              onChange={(e) =>
                setBranding((b) => ({ ...b, whatsapp_cta: e.target.value }))
              }
              placeholder="https://wa.me/52155..."
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button onClick={save} disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar marca"}
        </Button>
      </CardContent>
    </Card>
  );
}
