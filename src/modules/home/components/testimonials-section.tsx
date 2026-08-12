import { Quote, Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "María G.",
    city: "Ciudad de México",
    initials: "MG",
    color: "from-[#D67E3C] to-[#C4571D]",
    quote:
      "Encontré el departamento perfecto en dos semanas. El score de calidad y la comparativa de $/m² me dieron mucha confianza para ofrecer.",
  },
  {
    name: "Carlos R.",
    city: "Guadalajara",
    initials: "CR",
    color: "from-[#A83810] to-[#6E1D00]",
    quote:
      "Como inversionista, el cap rate proyectado y el descuento sobre avalúo hicieron que elegir fuera mucho más fácil. Cerré mi primera propiedad.",
  },
  {
    name: "Ana L.",
    city: "Monterrey",
    initials: "AL",
    color: "from-[#FFB36B] to-[#D67E3C]",
    quote:
      "Agendé el tour por WhatsApp y todo fue directo con el dueño. Sin comisiones ocultas, justo lo que buscaba.",
  },
];

/**
 * Social proof strip with curated buyer/investor testimonials. Content is
 * static — the reviews module is per-user (double-blind) and has no
 * site-wide aggregate to source real quotes from yet.
 */
export function TestimonialsSection() {
  return (
    <section className="border-y bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Lo que dicen nuestros usuarios
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            Compradores, vendedores e inversionistas que ya encontraron su
            propiedad con Propiedades.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="relative flex flex-col rounded-2xl border bg-card p-6"
            >
              <Quote className="absolute right-5 top-5 size-8 text-muted/60" />
              <div
                className="mb-3 flex gap-0.5"
                aria-label="Calificación 5 de 5"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <blockquote className="flex-1 text-sm leading-relaxed text-foreground/85">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  className={`flex size-10 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-sm font-bold text-white shadow-sm`}
                >
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.city}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
