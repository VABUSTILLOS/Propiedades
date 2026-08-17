import type { Metadata } from "next";
import { headers } from "next/headers";
import { Store } from "lucide-react";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { env } from "@/modules/lib/env";
import { ListingWizard } from "@/modules/listings/components/listing-wizard";

export const metadata: Metadata = { title: "Publicar una propiedad" };

type InitialMapCenter = {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
};

type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

const FALLBACK_CENTER: InitialMapCenter = {
  lat: 19.4326,
  lng: -99.1332,
  city: "Ciudad de México",
  state: "CDMX",
};

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

async function geocodeCityCenter(
  city?: string,
  state?: string,
  countryCode?: string,
): Promise<Pick<InitialMapCenter, "lat" | "lng"> | null> {
  const key = env.googleMapsServerKey;
  if (!key || !city) return null;

  const query = [city, state, countryCode === "MX" ? "México" : countryCode]
    .filter(Boolean)
    .join(", ");

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      query,
    )}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json()) as GoogleGeocodeResponse;
    const location = data.results?.[0]?.geometry?.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      return null;
    }

    return { lat: Number(location.lat), lng: Number(location.lng) };
  } catch {
    return null;
  }
}

async function getInitialMapCenter(): Promise<InitialMapCenter> {
  const headerStore = await headers();
  const city = decodeHeader(headerStore.get("x-vercel-ip-city"));
  const state = decodeHeader(headerStore.get("x-vercel-ip-country-region"));
  const countryCode = decodeHeader(headerStore.get("x-vercel-ip-country"));
  const lat = Number(headerStore.get("x-vercel-ip-latitude"));
  const lng = Number(headerStore.get("x-vercel-ip-longitude"));

  const cityCenter = await geocodeCityCenter(city, state, countryCode);
  if (cityCenter) {
    return {
      ...cityCenter,
      city,
      state,
    };
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return FALLBACK_CENTER;

  return {
    lat,
    lng,
    city,
    state,
  };
}

export default async function NewListingPage() {
  const [user, initialMapCenter] = await Promise.all([getCurrentUser(), getInitialMapCenter()]);

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <GuestGate
          title="Publica una propiedad"
          description="Completa un solo formulario para crear y publicar tu listado. Crea una cuenta para empezar."
          next="/listings/new"
          actionLabel="Crear cuenta y publicar"
        />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vender"
        icon={Store}
        title={<>Publicar una <Em>propiedad</Em></>}
        description="Completa toda la información en una sola ventana y publica tu propiedad en minutos."
        className="mb-8"
      />

      <ListingWizard initialMapCenter={initialMapCenter} />
    </PageShell>
  );
}
