import { NextResponse } from "next/server";

import { runChatSearch } from "@/modules/chat/search";
import { chatRequestSchema, type ChatResponse } from "@/modules/chat/types";
import { getSearchableCities } from "@/modules/search/queries";

export const runtime = "nodejs";

export const maxDuration = 30;

/**
 * POST /api/chat
 * Body: { message: string, previousFilters?: ChatFilters, includeAlternatives?: boolean }
 * Interprets a natural-language query, searches active listings and returns
 * a reply plus result cards for the chat UI. Stateless per request — the
 * client holds the previous filters for follow-up refinements. By default the
 * search is strict; pass includeAlternatives to opt into relaxed results.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message ?? "Solicitud inválida";
    return NextResponse.json({ error: detail }, { status: 400 });
  }

  const { message, previousFilters, includeAlternatives } = parsed.data;

  try {
    const cities = await getSearchableCities();
    const response = await runChatSearch(message, cities, previousFilters, {
      mode: includeAlternatives ? "alternatives" : "strict",
    });

    return NextResponse.json(response satisfies ChatResponse);
  } catch {
    return NextResponse.json(
      { error: "No se pudo completar la búsqueda. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
