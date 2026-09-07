import { NextResponse } from "next/server";
import { z } from "zod";

import { requireKieAiAdmin } from "@/app/api/admin/kie-ai/guard";
import {
  createVideoTask,
  isKieAiConfigured,
  kieAiErrorResponse,
} from "@/lib/ai/kie-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const;

const VideoRequestSchema = z.object({
  prompt: z.string().trim().min(1, "El prompt es obligatorio.").max(4000),
  // Veo endpoint requires a model (default "veo3_fast" — validated against the
  // real API) plus an aspect ratio (docs default "16:9").
  model: z.string().trim().min(1).optional(),
  aspect_ratio: z.enum(VIDEO_ASPECT_RATIOS).optional(),
});

/**
 * Start an async Kie.ai video generation task.
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
  const parsed = VideoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { prompt, model, aspect_ratio } = parsed.data;

  try {
    const task = await createVideoTask({
      prompt,
      model: model ?? "veo3_fast",
      aspect_ratio: aspect_ratio ?? "16:9",
    });
    return NextResponse.json({ taskId: task.taskId });
  } catch (err) {
    return kieAiErrorResponse(err);
  }
}
