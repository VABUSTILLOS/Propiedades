import { requireUserOrThrow } from "@/modules/auth/session";
import { parseInput } from "@/modules/lib/action-result";
import { importUrlSchema } from "@/modules/importer/schemas";
import {
  importPropertyFromContent,
  importPropertyFromUrl,
} from "@/modules/importer/server";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let user;
  try {
    user = await requireUserOrThrow();
  } catch {
    return Response.json(
      { ok: false, error: "Inicia sesión para importar propiedades." },
      { status: 401 },
    );
  }
  void user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "JSON inválido en el cuerpo de la petición." },
      { status: 400 },
    );
  }

  const parsed = parseInput(importUrlSchema, body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const { url, content } = parsed.data;
  const result = content?.trim()
    ? await importPropertyFromContent(content, url)
    : await importPropertyFromUrl(url);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, data: result.data });
}
