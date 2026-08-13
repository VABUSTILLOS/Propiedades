import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * "Invertir" was merged into "Comprar" at /search. The opportunity tabs map
 * 1:1 to the new cintillo tabs (todos|remate|flipping|traspaso|comercial|
 * terreno), so the tab and the presentation params are forwarded verbatim.
 */
export default async function InvestorRedirect({ searchParams }: Props) {
  const raw = await searchParams;
  const params = new URLSearchParams();

  const forward = (key: string) => {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  };

  forward("tab");
  forward("categories");
  forward("bounds");
  forward("view");
  forward("mapSearch");

  const qs = params.toString();
  permanentRedirect(qs ? `/search?${qs}` : "/search");
}
