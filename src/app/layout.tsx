import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono, Instrument_Serif } from "next/font/google";

import { QueryProvider } from "@/modules/lib/react-query/provider";
import { CommandPalette } from "@/modules/search/components/command-palette";
import { resolveTenant } from "@/modules/profiles/tenant";
import { getCurrentUser } from "@/modules/auth/session";
import { SiteHeader } from "@/modules/home/components/site-header";
import { SiteFooter } from "@/modules/home/components/site-footer";

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
    default: "100Casas — Marketplace inmobiliario de México",
    template: "%s | 100Casas",
  },
  description:
    "No listamos todo, solo lo que vale la pena. Aquí encuentras las 100 mejores oportunidades de tu ciudad, listadas a la vez, para que descubras la mejor casa para ti. 🏠✨",
  icons: {
    icon: [{ url: "/favicon.webp", type: "image/webp", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "100Casas.mx",
    title: "100Casas.mx — Solo lo que vale la pena",
    description:
      "No listamos todo, solo lo que vale la pena. Aquí encuentras las 100 mejores oportunidades de tu ciudad, listadas a la vez, para que descubras la mejor casa para ti. 🏠✨",
  },
  twitter: {
    card: "summary_large_image",
    title: "100Casas.mx — Solo lo que vale la pena",
    description:
      "No listamos todo, solo lo que vale la pena. Aquí encuentras las 100 mejores oportunidades de tu ciudad, listadas a la vez, para que descubras la mejor casa para ti. 🏠✨",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets fixed bars (mobile CTA) extend into the notch area; padding uses
  // env(safe-area-inset-*) so content stays clear of the home indicator.
  viewportFit: "cover",
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
      <head>
        {/* Applies the stored/system theme before first paint so there is no
            flash of the wrong color scheme. The desktop view is session-only
            (reset on every load), so it is deliberately not restored here;
            any legacy stored value is cleared. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{localStorage.removeItem('desktopView');var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader user={user} />
        <QueryProvider>
          <div className="flex flex-1 flex-col">{children}</div>
          <CommandPalette />
        </QueryProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
