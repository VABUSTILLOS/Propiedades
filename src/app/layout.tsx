import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";

import { QueryProvider } from "@/modules/lib/react-query/provider";
import { CommandPalette } from "@/modules/search/components/command-palette";
import { resolveTenant } from "@/modules/profiles/tenant";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  const tenant = await resolveTenant();
  const brand = tenant.branding;

  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      style={
        {
          "--brand": brand.primary_color,
          "--brand-foreground": "#FFFFFF",
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          {children}
          <CommandPalette />
        </QueryProvider>
      </body>
    </html>
  );
}

