import { redirect } from "next/navigation";

export const metadata = { title: "Editar propiedad" };

export const dynamic = "force-dynamic";

/**
 * Admin edit surface now delegates to the shared owner+admin editor so both
 * roles hydrate the same single-form wizard (`/listings/[id]/editar`). The
 * shared route re-validates admin access on redirect.
 */
export default async function AdminEditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/listings/${id}/editar`);
}
