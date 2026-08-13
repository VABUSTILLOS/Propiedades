import { z } from "zod";

import { applyAnswer, getIntakeState } from "@/modules/intake/server";
import { answerRequestSchema } from "@/modules/intake/schemas";

export const dynamic = "force-dynamic";

const tokenSchema = z.string().uuid();

/**
 * Token-gated intake state for the "Sube tu propiedad" wizard.
 * The UUID token in the URL is the capability: no session required, and the
 * service role key never leaves the server.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!tokenSchema.safeParse(token).success) {
    return Response.json({ ok: false, error: "Enlace no válido." }, { status: 404 });
  }

  const result = await getIntakeState(token);
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error:
          result.error === "expired"
            ? "Este enlace expiró. Escríbenos de nuevo por WhatsApp para generar uno nuevo."
            : "Enlace no válido.",
      },
      { status: result.error === "expired" ? 410 : 404 },
    );
  }

  return Response.json({ ok: true, data: result.state });
}

/** Save one slide answer; returns the refreshed state for optimistic advance. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!tokenSchema.safeParse(token).success) {
    return Response.json({ ok: false, error: "Enlace no válido." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Cuerpo JSON no válido." }, { status: 400 });
  }

  const parsed = answerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Respuesta no válida para este campo." },
      { status: 400 },
    );
  }

  const result = await applyAnswer(token, parsed.data.field, parsed.data.value);
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error:
          result.error === "expired"
            ? "Este enlace expiró. Escríbenos de nuevo por WhatsApp para generar uno nuevo."
            : "Enlace no válido o respuesta rechazada.",
      },
      { status: result.error === "expired" ? 410 : 400 },
    );
  }

  return Response.json({ ok: true, data: result.state });
}
