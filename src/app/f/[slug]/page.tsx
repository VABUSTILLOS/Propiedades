import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getFlyerBySlug } from "@/modules/flyers/queries";
import { getListingById } from "@/modules/listings/queries";
import { FlyerViewer } from "@/modules/flyers/components/flyer-viewer";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const flyer = await getFlyerBySlug(slug);
  return { title: flyer?.custom_title ?? "Flyer de propiedad" };
}

export default async function FlyerPage({ params }: Props) {
  const { slug } = await params;
  const flyer = await getFlyerBySlug(slug);
  if (!flyer) notFound();

  const property = await getListingById(flyer.property_id);
  if (!property) notFound();

  return (
    <main className="min-h-screen bg-muted/40 py-10">
      <FlyerViewer flyer={flyer} property={property} />
    </main>
  );
}
