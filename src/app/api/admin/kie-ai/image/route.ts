import { NextResponse } from "next/server";
import { z } from "zod";

import { requireKieAiAdmin } from "@/app/api/admin/kie-ai/guard";
import {
  createImageTask,
  isKieAiConfigured,
  kieAiErrorResponse,
} from "@/lib/ai/kie-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_SIZES = ["1:1", "3:2", "2:3"] as const;

const ImageRequestSchema = z.object({
  prompt: z.string().trim().min(1, "El prompt es obligatorio.").max(4000),
  // gpt4o-image requires size (1:1 | 3:2 | 2:3); "model" is NOT part of the schema.
  size: z.enum(IMAGE_SIZES).optional(),
});

/**
 * Start an async Kie.ai image generation task.
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
  const parsed = ImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { prompt, size } = parsed.data;

  try {
    const task = await createImageTask({ prompt, size: size ?? "1:1" });
    return NextResponse.json({ taskId: task.taskId });
  } catch (err) {
    return kieAiErrorResponse(err);
  }
}
