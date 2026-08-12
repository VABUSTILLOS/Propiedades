import { CalendarClock, Calculator, Gauge, MessageCircle, Search, Target } from "lucide-react";

const BUYER_STEPS = [
  {
    icon: Search,
    title: "Busca y compara",
    description:
      "Filtra por ciudad, precio, $/m² y calidad. Compara propiedades lado a lado.",
  },
  {
    icon: CalendarClock,
    title: "Agenda un tour",
    description:
      "Reserva visitas en el horario del dueño o agente, por la app o WhatsApp.",
  },
  {
    icon: MessageCircle,
    title: "Ofrece y cierra",
    description:
      "Envía ofertas digitales, mensajea directo y sigue el proceso hasta el cierre.",
  },
];

const INVESTOR_ROW = [
  {
    icon: Calculator,
    title: "Valuación automática",
    description: "Avalúo estimado y descuento sobre precio en cada propiedad.",
  },
  {
    icon: Target,
    title: "$/m² vs colonia",
    description: "Compara contra benchmarks del mercado y detecta oportunidades.",
  },
  {
    icon: Gauge,
    title: "Cap rate proyectado",
    description: "Renta mensual estimada y rendimiento por propiedad.",
  },
];

/**
 * "Cómo funciona" section: buyer journey steps + investor value props.
 */
export function HowItWorksSection() {
  return (
    <section className="border-y bg-muted/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Encuentra tu próxima propiedad en 3 pasos
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            Un proceso transparente, de la búsqueda al cierre, sin letras chiquitas.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {BUYER_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative rounded-xl border bg-card p-6">
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--brand)] px-3 py-0.5 text-xs font-semibold text-[var(--brand-foreground)]">
                  Paso {index + 1}
                </span>
                <span className="mb-4 flex size-11 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12">
          <h3 className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Para inversionistas
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {INVESTOR_ROW.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
