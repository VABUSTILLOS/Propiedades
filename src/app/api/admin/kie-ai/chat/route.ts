import { NextResponse } from "next/server";
import { z } from "zod";

import { requireKieAiAdmin } from "@/app/api/admin/kie-ai/guard";
import {
  chatCompletion,
  isKieAiConfigured,
  kieAiErrorResponse,
  type KieAiChatMessage,
} from "@/lib/ai/kie-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1).max(10_000),
      }),
    )
    .min(1, "Se requiere al menos un mensaje."),
  model: z.string().trim().min(1),
  temperature: z.number().min(0).max(2).optional(),
});

/**
 * Synchronous Kie.ai LLM chat (OpenAI-compatible). Returns `{ content }`.
 * Unlike image/video/music, this call completes within the request.
 */
export async function POST(request: Request) {
  const guard = await requireKieAiAdmin();
  if (!guard.ok) return guard.response;

  if (!isKieAiConfigured()) {
    return NextResponse.json(
      { error: "KIEAI_API_KEY no está configurada en el servidor." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { messages, model, temperature } = parsed.data;

  try {
    const result = await chatCompletion({
      model,
      messages: messages as KieAiChatMessage[],
      ...(temperature !== undefined ? { temperature } : {}),
    });
    return NextResponse.json({ content: result.content });
  } catch (err) {
    return kieAiErrorResponse(err);
  }
}
