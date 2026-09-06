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

const MusicRequestSchema = z.object({
  prompt: z.string().trim().min(1, "El prompt es obligatorio.").max(4000),
  model: z.string().trim().min(1).optional(),
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

  const { prompt, model } = parsed.data;

  try {
    const task = await createMusicTask(model ? { prompt, model } : { prompt });
    return NextResponse.json({ taskId: task.taskId });
  } catch (err) {
    return kieAiErrorResponse(err);
  }
}
