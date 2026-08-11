import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { QueryProvider } from "@/modules/lib/react-query/provider";
import { resolveTenant } from "@/modules/profiles/tenant";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Propiedades — Real Estate Marketplace",
    template: "%s | Propiedades",
  },
  description:
    "Two-sided real estate marketplace for buyers, investors, agents and FSBO owners.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tenant = await resolveTenant();
  const brand = tenant.branding;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={
        {
          "--brand": brand.primary_color,
          "--brand-foreground": "#FFFFFF",
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

