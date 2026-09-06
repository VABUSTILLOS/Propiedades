import { NextResponse } from "next/server";

import { requireKieAiAdmin } from "@/app/api/admin/kie-ai/guard";
import {
  getTaskStatus,
  isKieAiConfigured,
  kieAiErrorResponse,
} from "@/lib/ai/kie-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Poll endpoint for async Kie.ai tasks. Returns the current task record
 * (state + result when available) for a given taskId.
 *
 * Example: GET /api/admin/kie-ai/status?taskId=<id>
 */
export async function GET(request: Request) {
  const guard = await requireKieAiAdmin();
  if (!guard.ok) return guard.response;

  if (!isKieAiConfigured()) {
    return NextResponse.json(
      { error: "KIEAI_API_KEY no está configurada en el servidor." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json(
      { error: "Falta el parámetro taskId." },
      { status: 400 },
    );
  }

  try {
    const record = await getTaskStatus(taskId);
    return NextResponse.json(record);
  } catch (err) {
    return kieAiErrorResponse(err);
  }
}
