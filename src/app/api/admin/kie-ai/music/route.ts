import { NextResponse } from "next/server";
import { z } from "zod";

import { requireKieAiAdmin } from "@/app/api/admin/kie-ai/guard";
import {
  createMusicTask,
  isKieAiConfigured,
  kieAiErrorResponse,
} from "@/lib/ai/kie-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUNO_MODELS = [
  "V3_5",
  "V4",
  "V4_5",
  "V4_5PLUS",
  "V4_5ALL",
  "V5",
  "V5_5",
] as const;

const MusicRequestSchema = z.object({
  prompt: z.string().trim().min(1, "El prompt es obligatorio.").max(4000),
  // Music endpoint (/api/v1/generate, Suno schema) requires these fields;
  // customMode/instrumental default to false, model defaults to V4_5.
  customMode: z.boolean().optional(),
  instrumental: z.boolean().optional(),
  model: z.enum(SUNO_MODELS).optional(),
  // The API requires a callBackUrl. Optional in the request body: falls back
  // to the KIEAI_CALLBACK_URL env var; a 400 is returned if neither exists.
  callBackUrl: z.string().url("callBackUrl debe ser una URL válida.").optional(),
});

/**
 * Start an async Kie.ai music generation task.
 * Returns the `taskId` immediately; poll GET /api/admin/kie-ai/status?taskId=...
 * until the task reaches a terminal state.
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
  const parsed = MusicRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { prompt, customMode, instrumental, model, callBackUrl } = parsed.data;

  const callback = callBackUrl ?? process.env.KIEAI_CALLBACK_URL;
  if (!callback) {
    return NextResponse.json(
      {
        error:
          "Falta callBackUrl: la API de música de Kie.ai exige una URL de callback. Envíala en el body o define KIEAI_CALLBACK_URL en el servidor.",
      },
      { status: 400 },
    );
  }

  try {
    const task = await createMusicTask({
      prompt,
      customMode: customMode ?? false,
      instrumental: instrumental ?? false,
      model: model ?? "V4_5",
      callBackUrl: callback,
    });
    return NextResponse.json({ taskId: task.taskId });
  } catch (err) {
    return kieAiErrorResponse(err);
  }
}
