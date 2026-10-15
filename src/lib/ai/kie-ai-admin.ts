/**
 * Kie.ai admin client — SERVER-ONLY.
 *
 * Thin wrapper over the repo's existing admin routes under
 * `src/app/api/admin/kie-ai/*`. It does NOT talk to api.kie.ai directly nor
 * read KIEAI_API_KEY: it forwards the current session cookie to those routes,
 * which run the admin check (`getCurrentUser()` + role, see `guard.ts`) and
 * proxy the request. Kept intentionally thin — generation/chat logic lives in
 * `./kie-ai`, this module only marshals requests/responses.
 *
 * Only import from Server Actions, route handlers or server components, never
 * from client components. The shared client is `./kie-ai` (used by the admin
 * routes server-side); this wrapper exists for code that needs to act on the
 * ADMIN routes on behalf of the signed-in user, e.g. a Server Action behind a
 * property-management page.
 *
 * Real response shapes (differ from Resurte.me / hustlealliance):
 *   - POST .../chat   → `{ content }`      (model is REQUIRED; no default)
 *   - POST .../image  → `{ taskId }`        (body: prompt + optional size)
 *   - POST .../video  → `{ taskId }`        (body: prompt, model?, aspect_ratio?)
 *   - POST .../music  → `{ taskId }`        (callBackUrl optional → env fallback)
 *   - GET .../status  → task record DIRECTLY, not wrapped in `{ record }`
 */

import { cookies } from "next/headers";

import type { KieAiChatMessage, KieAiTaskRecord } from "./kie-ai";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ─── Low-level fetch helper ───────────────────────────────────────────────

/**
 * Extrae el mensaje de error legible del cuerpo de una respuesta fallida de
 * las rutas admin (`{ error }` en español, o `detail`/`issue` de zod). Si no
 * hay ninguno, devuelve null para usar el fallback de estado HTTP.
 */
function extractErrorText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of ["error", "detail", "issue"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

/**
 * Llamada tipada a una ruta admin de Kie.ai reenviando la cookie de sesión
 * actual (`next/headers`, async en Next 16). Lanza un Error en español si la
 * ruta responde con un código de error.
 */
async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookie = (await cookies()).toString();

  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    // Las rutas devuelven estado/resultado mutable; nunca cachear.
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!res.ok) {
    const detail = extractErrorText(json);
    throw new Error(
      detail ??
        `La ruta admin de Kie.ai respondió con el estado HTTP ${res.status}.`,
    );
  }

  return json as T;
}

// ─── Tipos de salida ──────────────────────────────────────────────────────

/** Respuesta de POST /api/admin/kie-ai/chat → `{ content }` (sin `raw`). */
export interface KieAdminChatResponse {
  content: string;
}

/** Respuesta de los endpoints de tarea asíncrona → `{ taskId }`. */
export interface KieTaskResponse {
  taskId: string;
}

/** Tamaños de imagen aceptados por la ruta (gpt4o-image). Default "1:1". */
export type KieImageSize = "1:1" | "3:2" | "2:3";

/** Ratios de aspecto de video aceptados por la ruta (Veo). Default "16:9". */
export type KieVideoAspectRatio = "16:9" | "9:16" | "1:1";

/** Modelos de música aceptados por la ruta (Suno). Default "V4_5". */
export type KieMusicModel =
  | "V3_5"
  | "V4"
  | "V4_5"
  | "V4_5PLUS"
  | "V4_5ALL"
  | "V5"
  | "V5_5";

/** Opciones opcionales para POST /api/admin/kie-ai/music. */
export interface KieMusicOptions {
  model?: KieMusicModel;
  customMode?: boolean;
  instrumental?: boolean;
  /** Si se omite, la ruta usa el env KIEAI_CALLBACK_URL (400 si tampoco existe). */
  callBackUrl?: string;
}

// ─── Funciones por endpoint ───────────────────────────────────────────────

/**
 * Chat LLM síncrono vía la ruta admin. La ruta de Propiedades EXIGE `model`
 * (no hay default), así que se valida aquí con un error claro en español.
 */
export async function kieChat(
  messages: KieAiChatMessage[],
  model?: string,
): Promise<KieAdminChatResponse> {
  if (!model || model.trim() === "") {
    throw new Error(
      'kieChat exige un "model" (p. ej. "gemini-2.5-flash"): la ruta /api/admin/kie-ai/chat no aplica un modelo por defecto.',
    );
  }
  return adminFetch<KieAdminChatResponse>("/api/admin/kie-ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages, model }),
  });
}

/** Inicia una tarea de generación de imagen y devuelve el `taskId`. */
export function kieImage(
  prompt: string,
  size?: KieImageSize,
): Promise<KieTaskResponse> {
  return adminFetch<KieTaskResponse>("/api/admin/kie-ai/image", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      ...(size ? { size } : {}),
    }),
  });
}

/** Inicia una tarea de generación de video y devuelve el `taskId`. */
export function kieVideo(
  prompt: string,
  model?: string,
  aspectRatio?: KieVideoAspectRatio,
): Promise<KieTaskResponse> {
  return adminFetch<KieTaskResponse>("/api/admin/kie-ai/video", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      ...(model ? { model } : {}),
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    }),
  });
}

/** Inicia una tarea de generación de música y devuelve el `taskId`. */
export function kieMusic(
  prompt: string,
  opts: KieMusicOptions = {},
): Promise<KieTaskResponse> {
  return adminFetch<KieTaskResponse>("/api/admin/kie-ai/music", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      ...(opts.customMode !== undefined ? { customMode: opts.customMode } : {}),
      ...(opts.instrumental !== undefined ? { instrumental: opts.instrumental } : {}),
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.callBackUrl ? { callBackUrl: opts.callBackUrl } : {}),
    }),
  });
}

/**
 * Consulta el estado de una tarea. La ruta GET /status devuelve el `record`
 * directamente; por robustez se tolera también el envoltorio `{ record }`
 * (formato de Resurte) por si el endpoint cambia en el futuro.
 */
export async function kieStatus(taskId: string): Promise<KieAiTaskRecord> {
  const json = await adminFetch<unknown>(
    `/api/admin/kie-ai/status?taskId=${encodeURIComponent(taskId)}`,
  );
  if (json && typeof json === "object" && "record" in json) {
    return (json as { record: KieAiTaskRecord }).record;
  }
  return json as KieAiTaskRecord;
}

const TERMINAL_STATES = new Set(["success", "fail", "error"]);

/**
 * Sondea `/status` cada 2 segundos hasta que la tarea llega a un estado
 * terminal (success / fail / error, comparados en minúsculas) o se agota el
 * timeout (120 s por defecto). Lanza un Error en español al agotar el tiempo.
 */
export async function kieWaitForTask(
  taskId: string,
  timeoutMs = 120_000,
): Promise<KieAiTaskRecord> {
  const start = Date.now();

  for (;;) {
    const record = await kieStatus(taskId);
    if (TERMINAL_STATES.has(String(record.state ?? "").toLowerCase())) {
      return record;
    }
    if (Date.now() - start >= timeoutMs) {
      throw new Error(
        `Se agotó el tiempo de espera (${timeoutMs} ms) para la tarea de Kie.ai ${taskId}.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}
