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
    default: "Propiedades — Marketplace inmobiliario de México",
    template: "%s | Propiedades",
  },
  description:
    "Compra, renta, invierte y vende propiedades en México con valuaciones, tours, ofertas digitales y procesos transparentes.",
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
        {/* Applies the stored/system theme and desktop view before first paint
            so there is no flash of the wrong color scheme or layout. Keep in
            sync with ThemeToggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}if(localStorage.getItem('desktopView')==='true'){document.documentElement.classList.add('desktop-view');var m=document.querySelector('meta[name=\"viewport\"]');if(m){m.setAttribute('data-original-viewport',m.content);var s=Math.min(screen.width/1280,1);m.setAttribute('content','width=1280, initial-scale='+s+', maximum-scale='+s+', minimum-scale='+s+', user-scalable=no')}}}catch(e){}",
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
