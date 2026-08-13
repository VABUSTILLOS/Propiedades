import { FolioLabel } from "@/modules/home/components/folio-label";

const STEPS = [
  {
    index: "01",
    title: "Rastreamos todo el mercado",
    description:
      "Portales, remates bancarios, traspasos y dueños directos. Primero lo vemos todo — sin filtros de entrada.",
  },
  {
    index: "02",
    title: "Comparamos contra cada colonia",
    description:
      "Cruzamos precio, $/m² y renta potencial con el benchmark de la colonia. La mayoría de las publicaciones no pasa.",
  },
  {
    index: "03",
    title: "Publicamos solo las que ganan",
    description:
      "Si no supera al mercado, no entra al registro. Las que entran muestran sus números completos, sin letra chica.",
  },
];

/**
 * "Método de selección" — the curation manifesto. Three numbered steps
 * with oversized mono numerals; the registry rule closes the section.
 * Replaces the generic "how it works" grid with the story that actually
 * differentiates the product: we filter, portals list.
 */
export function SelectionMethodSection() {
  return (
    <section className="border-y bg-muted/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <FolioLabel index="03" title="Método de selección" />
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Cómo entra una propiedad al{" "}
          <em className="font-display italic">registro</em>
        </h2>

        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.index} className="border-t-2 border-foreground/15 pt-6">
              <span className="font-mono text-4xl font-semibold tracking-tight text-primary/80">
                {step.index}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-14 border-l-2 border-primary pl-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Regla del registro — si no tiene ventaja medible, no se publica
        </p>
      </div>
    </section>
  );
}
