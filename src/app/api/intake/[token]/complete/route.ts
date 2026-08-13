import { z } from "zod";

import { activateIntake } from "@/modules/intake/server";

export const dynamic = "force-dynamic";

const tokenSchema = z.string().uuid();

/**
 * Final wizard step: validate completeness, compute the opportunity score
 * against the colonia benchmark and flip the property to status='active'
 * (which is what makes it visible in the public feed, per RLS).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!tokenSchema.safeParse(token).success) {
    return Response.json({ ok: false, error: "Enlace no válido." }, { status: 404 });
  }

  const result = await activateIntake(token);
  if (!result.ok) {
    const status =
      result.error === "expired" ? 410 : result.error === "incomplete" ? 409 : 404;
    const error =
      result.error === "expired"
        ? "Este enlace expiró. Escríbenos de nuevo por WhatsApp para generar uno nuevo."
        : result.error === "incomplete"
          ? "Aún faltan datos por completar."
          : "Enlace no válido.";
    return Response.json({ ok: false, error }, { status });
  }

  return Response.json({
    ok: true,
    data: {
      slug: result.slug,
      opportunityScore: result.opportunityScore,
      discountPct: result.discountPct,
      benchmarkM2: result.benchmarkM2,
    },
  });
}
