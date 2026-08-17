import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * "Listados" was merged into "Comprar" at /search. The listados tabs map to
 * search params: venta → type=sale, renta → type=rent, tierra → the terreno
 * cintillo tab. Shared refinements (query, price, m², city, bounds) carry over.
 */
export default async function ListadosRedirect({ searchParams }: Props) {
  const raw = await searchParams;
  const params = new URLSearchParams();

  const forward = (key: string) => {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  };

  const tab = raw.tab;
  if (tab === "venta") params.set("type", "sale");
  else if (tab === "renta") {
    // Rentals live on /rentas, not /search (Comprar). Carry shared filters over.
    for (const key of [
      "query",
      "minPrice",
      "maxPrice",
      "city",
      "colonia",
      "minM2",
      "maxM2",
      "minBedrooms",
      "sortBy",
      "bounds",
      "view",
      "mapSearch",
    ]) {
      forward(key);
    }
    const qs = params.toString();
    permanentRedirect(qs ? `/rentas?${qs}` : "/rentas");
  } else if (tab === "tierra") params.set("tab", "terreno");

  for (const key of [
    "query",
    "minPrice",
    "maxPrice",
    "city",
    "colonia",
    "minM2",
    "maxM2",
    "minBedrooms",
    "sortBy",
    "bounds",
    "view",
    "mapSearch",
  ]) {
    forward(key);
  }

  const qs = params.toString();
  permanentRedirect(qs ? `/search?${qs}` : "/search");
}
