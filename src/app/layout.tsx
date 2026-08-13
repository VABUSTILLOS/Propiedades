import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono, Instrument_Serif } from "next/font/google";

import { QueryProvider } from "@/modules/lib/react-query/provider";
import { CommandPalette } from "@/modules/search/components/command-palette";
import { resolveTenant } from "@/modules/profiles/tenant";
import { getCurrentUser } from "@/modules/auth/session";
import { SiteHeader } from "@/modules/home/components/site-header";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Propiedades — Marketplace inmobiliario de México",
    template: "%s | Propiedades",
  },
  description:
    "Compra, renta, invierte y vende propiedades en México con valuaciones, tours, ofertas digitales y procesos transparentes.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [tenant, user] = await Promise.all([
    resolveTenant(),
    getCurrentUser(),
  ]);
  const brand = tenant.branding;

  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${geistMono.variable} ${instrument.variable} h-full antialiased`}
      style={
        {
          "--brand": brand.primary_color,
          "--brand-foreground": "#FFFFFF",
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader user={user} />
        <QueryProvider>
          {children}
          <CommandPalette />
        </QueryProvider>
      </body>
    </html>
  );
}
