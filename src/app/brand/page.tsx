import type { Metadata } from "next";
import { BookOpen, CheckCircle2, Check, X } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { Card, CardContent } from "@/components/ui/card";
import { ColorSwatch } from "@/modules/brand/components/color-swatch";
import { TypeSpecimen } from "@/modules/brand/components/type-specimen";
import { LogoAsset } from "@/modules/brand/components/logo-card";
import { VoiceCard } from "@/modules/brand/components/voice-card";
import {
  brandColorGroups,
  brandTokens,
  brandTypes,
  voiceExamples,
  voiceRules,
} from "@/modules/brand/data";

export const metadata: Metadata = {
  title: "Brand kit",
  description:
    "La identidad visual y de voz de Propiedades: color copper, typography, logotipo y lineamientos.",
};

export default function BrandPage() {
  return (
    <PageShell size="lg">
      <PageHeader
        eyebrow="Brand kit"
        icon={BookOpen}
        title={
          <span>
            La identidad de <Em>Propiedades</Em>
          </span>
        }
        description="Paleta copper sobre cream, voz de curador inmobiliario y un logotipo que cabe en un WhatsApp. Esto es la marca, documentada y lista para usar."
      />

      <div className="mt-10 space-y-12">
        {/* Logotipo */}
        <section id="logotipo" aria-labelledby="logotipo-title">
          <SectionTitle id="logotipo-title">Logotipo</SectionTitle>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            El símbolo es la vivienda dentro de un tile de gradiente cobre
            (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">from-copper to-copper-deep</code>).
            Cada versión vive en <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">/public/brand/</code> y
            es direccionable por URL.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LogoAsset index={0} />
            <LogoAsset index={1} />
            <LogoAsset index={2} />
            <LogoAsset index={3} />
            <LogoAsset index={4} />
            <div className="flex flex-col justify-center rounded-xl bg-ink p-6 text-ink-foreground ring-1 ring-foreground/10">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-foreground/60">
                Área de resguardo
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                Mantén un margen libre equivalente a la altura del símbolo en
                los cuatro lados. Nunca rotes, estires ni cambies los colores
                del logotipo.
              </p>
            </div>
          </div>
        </section>

        {/* Color */}
        <section id="color" aria-labelledby="color-title">
          <SectionTitle id="color-title">Color</SectionTitle>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Todos los valores provienen de las variables CSS de la app
            (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">src/app/globals.css</code>).
            Haz clic en cualquier swatch para copiar el hex.
          </p>
          <div className="space-y-8">
            {brandColorGroups.map((group) => (
              <div key={group.id}>
                <h3 className="text-sm font-medium">{group.title}</h3>
                <p className="mb-3 text-xs text-muted-foreground">{group.description}</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {group.colors.map((color) => (
                    <ColorSwatch key={color.token} color={color} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tipografía */}
        <section id="tipografia" aria-labelledby="tipografia-title">
          <SectionTitle id="tipografia-title">Tipografía</SectionTitle>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Un sistema de tres fuentes: una sans humanista para todo, una serif
            itálica para el momento editorial y una mono para la señalética técnica.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {brandTypes.map((type) => (
              <TypeSpecimen key={type.name} type={type} />
            ))}
          </div>
        </section>

        {/* Forma */}
        <section id="forma" aria-labelledby="forma-title">
          <SectionTitle id="forma-title">Forma</SectionTitle>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Radio suave en tarjetas y componentes, iconografía lucide de trazo
            consistente y gradientes de cobre para lo que debe sentirse vivo.
          </p>
          <Card>
            <CardContent>
              <dl className="divide-y">
                {brandTokens.map((token) => (
                  <div key={token.token} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <dt className="w-56 shrink-0 font-mono text-xs text-foreground">{token.token}</dt>
                    <dd className="flex-1 text-sm text-muted-foreground">{token.usage}</dd>
                    <dd className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs">{token.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>

        {/* Voz y tono */}
        <section id="voz-y-tono" aria-labelledby="voz-y-tono-title">
          <SectionTitle id="voz-y-tono-title">Voz y tono</SectionTitle>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {voiceRules.map((rule) => (
              <div key={rule.title} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <p className="text-sm font-medium">{rule.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.description}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {voiceExamples.map((example) => (
              <VoiceCard key={example.tone} example={example} />
            ))}
          </div>
        </section>

        {/* Checklist */}
        <section id="checklist" aria-labelledby="checklist-title">
          <SectionTitle id="checklist-title">Checklist de uso</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <CheckCard title="Sí" tone="live">
              <li>Usar cream como fondo y cobre para lo que debe llamar la atención.</li>
              <li>Respetar el área de resguardo del logotipo.</li>
              <li>Verificar contraste AA antes de usar primary sobre fondos de color.</li>
              <li>Usar Instrument Serif en una sola palabra clave por titular.</li>
              <li>Ser transparente: los datos siempre se muestran, no se esconden.</li>
            </CheckCard>
            <CheckCard title="No" tone="destructive">
              <li>Rotar, estirar o recolorar el logotipo fuera de las variantes oficiales.</li>
              <li>Usar el cobre como color de texto sobre fondos de cobre.</li>
              <li>Mezclar más de una fuente por línea o usar serif en párrafos.</li>
              <li>Escribir con hype («¡oportunidad única!») o jerga anglosajona.</li>
              <li>Anunciar un registro que no cumple el criterio de «vale la pena».</li>
            </CheckCard>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <CheckCircle2 className="size-4 text-primary" aria-hidden />
      <h2 id={id} className="text-xl font-bold tracking-tight">
        {children}
      </h2>
    </div>
  );
}

function CheckCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "live" | "destructive";
  children: React.ReactNode;
}) {
  const Icon = tone === "live" ? Check : X;
  const toneClass = tone === "live" ? "text-live-foreground" : "text-destructive";
  return (
    <Card>
      <CardContent className="pt-5">
        <p className={`mb-3 flex items-center gap-2 text-sm font-medium ${toneClass}`}>
          <Icon className="size-4" aria-hidden />
          {title}
        </p>
        <ul className="ml-4 list-disc space-y-1.5 text-sm leading-relaxed text-muted-foreground">
          {children}
        </ul>
      </CardContent>
    </Card>
  );
}
