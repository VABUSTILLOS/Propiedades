import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getMyFlyers } from "@/modules/flyers/queries";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Newspaper } from "lucide-react";

export const metadata: Metadata = { title: "Mis flyers" };

export default async function MyFlyersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <GuestGate
          title="Crea flyers digitales para tus listados"
          description="Páginas compartibles con métricas de visitas y captación de leads. Crea una cuenta para generar y medir tus flyers."
          next="/my-flyers"
        />
      </div>
    );
  }

  const flyers = await getMyFlyers(user.id);

  return (
    <PageShell size="md">
      <PageHeader
        eyebrow="Vender"
        icon={Newspaper}
        title="Flyers digitales"
        description="Páginas compartibles y con métricas para tus listados."
        className="mb-8"
      />

      {flyers.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          description="Aún no tienes flyers. Crea uno desde cualquiera de tus listados."
        />
      ) : (
        <div className="space-y-3">
          {flyers.map((flyer) => (
            <Link key={flyer.id} href={`/my-flyers/${flyer.id}`} className="block">
              <Card className="transition-colors hover:border-primary">
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {flyer.custom_title ?? "Flyer sin título"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {flyer.views_count ?? 0} vistas ·{" "}
                      {new Date(flyer.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    /f/{flyer.slug}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
