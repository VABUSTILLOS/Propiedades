/**
 * Generic Kie.ai client (https://docs.kie.ai/).
 *
 * Kie.ai is a single-API-key aggregator for image, video, music and LLM
 * models. Generation endpoints (image/video/music) are ASYNCHRONOUS: the
 * create call returns a `taskId`, and the result is retrieved by polling
 * `GET /api/v1/jobs/recordInfo?taskId=...`. LLM/chat calls are synchronous
 * and OpenAI-compatible.
 *
 * This module is the reusable Kie.ai pilot adapted from the Hustle Alliance
 * reference (VABUSTILLOS/hustlealliance#14). Two repo-specific adaptations:
 *  1. Reads `KIEAI_API_KEY` — the key already used by the existing Kie.ai chat
 *     fallback in `src/modules/ai/server.ts` — so one key powers both features.
 *  2. No `import "server-only"` guard (that package is not a dependency here).
 *     The module is only imported from server route handlers / server modules.
 *
 * Server-only by contract: the API key never reaches the client.
 */

import { NextResponse } from "next/server";

const KIE_AI_BASE_URL = "https://api.kie.ai";

export class KieAiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "KieAiError";
  }
}

/** True when KIEAI_API_KEY is configured. Check before calling the client to fail fast with a clear error. */
export function isKieAiConfigured(): boolean {
  return Boolean(process.env.KIEAI_API_KEY);
}

function getApiKey(): string {
  const key = process.env.KIEAI_API_KEY;
  if (!key) {
    throw new KieAiError(
      "KIEAI_API_KEY is not configured. Set it in your environment (see .env.example / docs/KIE_AI_PILOT.md).",
      500,
    );
  }
  return key;
}

/** Low-level fetch wrapper: adds auth + JSON headers, parses the response, and throws KieAiError on failure. */
async function kieFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  const res = await fetch(`${KIE_AI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    // Generation/status endpoints should never be cached by Next.js fetch caching.
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
    const message =
      (json &&
      typeof json === "object" &&
      "message" in json &&
      typeof (json as { message?: unknown }).message === "string"
        ? (json as { message: string }).message
        : null) || `Kie.ai request failed with status ${res.status}`;
    throw new KieAiError(message, res.status, json);
  }

  return json as T;
}

// ─── Models ──────────────────────────────────────────────────────────────

export interface KieAiModel {
  id: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

/** GET /api/v1/models — list available models across image/video/music/LLM. */
export async function listModels(): Promise<KieAiModel[]> {
  const data = await kieFetch<{ data?: KieAiModel[]; models?: KieAiModel[] }>(
    "/api/v1/models",
  );
  return data.data ?? data.models ?? [];
}

// ─── Async generation tasks (image / video / music) ───────────────────────

export interface CreateTaskResponse {
  taskId: string;
  [key: string]: unknown;
}

/**
 * Starts an async generation task on a given model endpoint (e.g. an image,
 * video, or music model route documented at docs.kie.ai). Returns the
 * `taskId` used to poll `recordInfo`.
 */
export async function createGenerationTask(
  modelPath: string,
  input: Record<string, unknown>,
): Promise<CreateTaskResponse> {
  const data = await kieFetch<{ data?: CreateTaskResponse; taskId?: string }>(
    modelPath,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  const taskId = data.taskId ?? data.data?.taskId;
  if (!taskId) {
    throw new KieAiError("Kie.ai response did not include a taskId", 502, data);
  }
  return { ...data.data, taskId };
}

/** Starts an image generation task. `modelPath` defaults to the general image generation endpoint. */
export function createImageTask(
  input: { prompt: string; model?: string; [key: string]: unknown },
  modelPath = "/api/v1/gpt4o-image/generate",
) {
  return createGenerationTask(modelPath, input);
}

/** Starts a video generation task. `modelPath` defaults to the general video generation endpoint. */
export function createVideoTask(
  input: { prompt: string; model?: string; [key: string]: unknown },
  modelPath = "/api/v1/veo/generate",
) {
  return createGenerationTask(modelPath, input);
}

/** Starts a music generation task. `modelPath` defaults to the general music generation endpoint. */
export function createMusicTask(
  input: { prompt: string; model?: string; [key: string]: unknown },
  modelPath = "/api/v1/suno/generate",
) {
  return createGenerationTask(modelPath, input);
}

export type KieAiTaskState =
  | "waiting"
  | "queuing"
  | "generating"
  | "success"
  | "fail"
  | string;

export interface KieAiTaskRecord {
  taskId: string;
  state: KieAiTaskState;
  resultJson?: string;
  failMsg?: string;
  [key: string]: unknown;
}

/** GET /api/v1/jobs/recordInfo?taskId=... — fetch current status/result of an async task. */
export async function getTaskStatus(taskId: string): Promise<KieAiTaskRecord> {
  const data = await kieFetch<
    { data?: KieAiTaskRecord } & Partial<KieAiTaskRecord>
  >(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
  return (data.data ?? data) as KieAiTaskRecord;
}

const TERMINAL_STATES = new Set(["success", "fail", "completed", "failed"]);

/**
 * Polls `recordInfo` until the task reaches a terminal state, or the timeout
 * elapses. Prefer webhooks in production for long-running video/music jobs;
 * this helper is convenient for short-lived pilot/demo usage.
 */
export async function pollTaskUntilComplete(
  taskId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<KieAiTaskRecord> {
  const { intervalMs = 3000, timeoutMs = 120_000 } = options;
  const start = Date.now();

  for (;;) {
    const record = await getTaskStatus(taskId);
    if (TERMINAL_STATES.has(record.state)) {
      return record;
    }
    if (Date.now() - start >= timeoutMs) {
      throw new KieAiError(
        `Timed out waiting for Kie.ai task ${taskId} to complete`,
        504,
        record,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ─── LLM / chat (synchronous, OpenAI-compatible) ──────────────────────────

export interface KieAiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface KieAiChatResult {
  content: string;
  raw: unknown;
}

/** POST /api/v1/chat/completions — synchronous, OpenAI chat-completions-compatible call. */
export async function chatCompletion(params: {
  model: string;
  messages: KieAiChatMessage[];
  temperature?: number;
}): Promise<KieAiChatResult> {
  const data = await kieFetch<{
    choices?: { message?: { content?: string } }[];
  }>("/api/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify(params),
  });
  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, raw: data };
}

// ─── Route helpers ─────────────────────────────────────────────────────────

/**
 * Convert a KieAiError into a NextResponse with the repo's standard
 * `{ error }` shape; rethrows anything else (let Next.js turn unknown
 * errors into a 500). Use in route handlers:
 *   try { ... } catch (err) { return kieAiErrorResponse(err); }
 */
export function kieAiErrorResponse(err: unknown): NextResponse {
  if (err instanceof KieAiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
