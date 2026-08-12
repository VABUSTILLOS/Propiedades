import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getFlyerAnalytics, getMyFlyerById } from "@/modules/flyers/queries";
import { FlyerEngagementPanel } from "@/modules/flyers/components/flyer-engagement-panel";
import { WhiteLabelShareButton } from "@/modules/flyers/components/white-label-share-button";
import { getListingById } from "@/modules/listings/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = { title: "Flyer analytics" };

export default async function FlyerAnalyticsPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <GuestGate
          title="Analiza el rendimiento de tus flyers"
          description="Visitas, leads capturados y tiempo de interacción de cada flyer. Crea una cuenta para ver tus métricas."
          next="/my-flyers"
        />
      </div>
    );
  }

  const flyer = await getMyFlyerById(id, user.id);
  if (!flyer) notFound();

  const [property, analytics] = await Promise.all([
    getListingById(flyer.property_id),
    getFlyerAnalytics(flyer.id),
  ]);

  const totalLeads = analytics.filter(
    (a) => a.lead_email != null || a.lead_phone != null,
  ).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {flyer.custom_title ?? "Flyer"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {property?.title ?? "Property"} ·{" "}
            <Link href={`/f/${flyer.slug}`} className="text-primary hover:underline">
              /f/{flyer.slug}
            </Link>
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Views" value={analytics.length} />
        <Stat label="Leads captured" value={totalLeads} />
        <Stat
          label="Avg engagement (s)"
          value={
            analytics.length > 0
              ? Math.round(
                  analytics.reduce((sum, a) => sum + (a.time_spent_seconds ?? 0), 0) /
                    analytics.length,
                )
              : 0
          }
        />
      </div>

      <div className="mb-6 rounded-lg border bg-card p-4">
        <WhiteLabelShareButton slug={flyer.slug} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent engagement</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No visits recorded yet. Share the flyer link to start collecting
              leads.
            </p>
          ) : (
            <ul className="divide-y">
              {analytics.slice(0, 20).map((event) => (
                <li key={event.id} className="flex justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {event.lead_email ?? event.lead_phone ?? "Anonymous visit"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.opened_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-muted-foreground">
                    {event.time_spent_seconds ?? 0}s
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <FlyerEngagementPanel
            flyerId={flyer.id}
            flyerSlug={flyer.slug}
            analytics={analytics}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
