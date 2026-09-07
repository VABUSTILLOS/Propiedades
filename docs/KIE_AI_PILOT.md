# Kie.ai pilot (Propiedades)

Generic [Kie.ai](https://docs.kie.ai/) integration — one API key for image,
video, music and LLM models — adapted from the Hustle Alliance pilot
([VABUSTILLOS/hustlealliance#14](https://github.com/VABUSTILLOS/hustlealliance/pull/14))
to this repo's structure and conventions.

## How Kie.ai works

- **Base URL**: `https://api.kie.ai`. Auth: `Authorization: Bearer <KIEAI_API_KEY>`.
- **Async generation** (image / video / music): the create call returns a
  `taskId`; the final result is fetched by polling
  `GET /api/v1/jobs/recordInfo?taskId=...` until a terminal state.
- **LLM / chat**: synchronous, OpenAI-chat-completions-compatible.

## Files

| File | Purpose |
| --- | --- |
| `src/lib/ai/kie-ai.ts` | Server-only Kie.ai client (native `fetch`, zero deps). |
| `src/app/api/admin/kie-ai/guard.ts` | Admin guard (401 anon / 403 non-admin) using `getCurrentUser()`. |
| `src/app/api/admin/kie-ai/image/route.ts` | `POST` → start image task, returns `{ taskId }`. |
| `src/app/api/admin/kie-ai/video/route.ts` | `POST` → start video task, returns `{ taskId }`. |
| `src/app/api/admin/kie-ai/music/route.ts` | `POST` → start music task, returns `{ taskId }`. |
| `src/app/api/admin/kie-ai/chat/route.ts` | `POST` synchronous LLM chat, returns `{ content }`. |
| `src/app/api/admin/kie-ai/status/route.ts` | `GET ?taskId=` → current task record. |
| `docs/KIE_AI_PILOT.md` | This document. |

## Setup

1. Get a `KIEAI_API_KEY` from the Kie.ai dashboard.
2. Copy `.env.example` to `.env.local` and uncomment/set:

   ```bash
   KIEAI_API_KEY=your-key
   # KIEAI_MODEL=gemini-2.5-flash   # optional, used by the existing chat fallback
   # KIEAI_CALLBACK_URL=https://your-app.example.com/kie-ai/music-callback
   ```

   `KIEAI_CALLBACK_URL` is only required for **music** generation (the Suno
   endpoint demands a `callBackUrl`). You can instead pass `callBackUrl` per
   request in the music route body.

   > This repo already used `KIEAI_API_KEY` (no underscore) for the Kie.ai chat
   > fallback in `src/modules/ai/server.ts`. The pilot reuses that same key —
   > there is intentionally **no** separate `KIE_AI_API_KEY` variable.

3. All endpoints are **admin-only**. Sign in as an admin in the browser, then
   export the session cookie for curl:

   ```bash
   export COOKIE='your_next_auth_or_supabase_cookie_here'
   ```

## Usage

### Create an image (async → taskId)

`POST /api/v1/gpt4o-image/generate` — the real endpoint requires `size`
(`1:1` default here, or `3:2` / `2:3`); `model` is **not** part of the 4o-image
schema.

```bash
curl -s -X POST http://localhost:3000/api/admin/kie-ai/image \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"Modern penthouse terrace at sunset in Mexico City, photorealistic"}'
# → {"taskId":"..."}

# Optional: override aspect ratio
curl -s -X POST http://localhost:3000/api/admin/kie-ai/image \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"...","size":"3:2"}'
```

### Poll task status

```bash
curl -s "http://localhost:3000/api/admin/kie-ai/status?taskId=TASK_ID" \
  -H "Cookie: $COOKIE"
# → { "taskId": "...", "state": "success", "resultUrls": ["https://..."], ... }
```

`state` transitions through `waiting` / `queuing` / `generating` to
`success` or `fail`. The client also ships `pollTaskUntilComplete(taskId)` for
server-side blocking (not exposed as a route).

### Video (Veo)

`POST /api/v1/veo/generate` — requires `model` (`veo3_fast` default here,
overridable) and `aspect_ratio` (`16:9` default).

```bash
curl -s -X POST http://localhost:3000/api/admin/kie-ai/video \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"Aerial drone tour of a colonial villa in San Miguel de Allende"}'

# Optional: override model / aspect ratio
curl -s -X POST http://localhost:3000/api/admin/kie-ai/video \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"...","model":"veo3","aspect_ratio":"9:16"}'
```

### Music (Suno)

`POST /api/v1/generate` (NOT `/api/v1/suno/generate`) — the Suno schema
requires `customMode`, `instrumental`, `model` and `callBackUrl`. The route
defaults `customMode`/`instrumental` to `false` and `model` to `V4_5`;
`callBackUrl` falls back to the `KIEAI_CALLBACK_URL` env var, or 400s if
neither is present. Valid models: `V3_5 | V4 | V4_5 | V4_5PLUS | V4_5ALL |
V5 | V5_5`.

```bash
curl -s -X POST http://localhost:3000/api/admin/kie-ai/music \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"Soft acoustic chillhop, 60 BPM"}'
# → {"taskId":"..."}   (uses KIEAI_CALLBACK_URL when set)

# If KIEAI_CALLBACK_URL is not configured, pass it per request:
curl -s -X POST http://localhost:3000/api/admin/kie-ai/music \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"...","model":"V5","instrumental":true,"callBackUrl":"https://your-app.example.com/kie-ai/music-callback"}'
```

### Chat (synchronous)

`POST /v1/chat/completions` — the real Kie.ai LLM path is **not**
`/api/v1/chat/completions` (404). Model goes in the request body, exactly like
the existing chat fallback in `src/modules/ai/server.ts`.

```bash
curl -s -X POST http://localhost:3000/api/admin/kie-ai/chat \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hola, resume la app en 1 línea"}]}'
# → { "content": "..." }
```

### From server code

```ts
import {
  createImageTask,
  createVideoTask,
  createMusicTask,
  pollTaskUntilComplete,
  chatCompletion,
  isKieAiConfigured,
} from "@/lib/ai/kie-ai";

if (isKieAiConfigured()) {
  const { taskId } = await createImageTask({ prompt: "…", size: "1:1" });
  const done = await pollTaskUntilComplete(taskId, { timeoutMs: 60_000 });
  // done.resultUrls / done.failMsg
}
```

## Real endpoints (validated live against the Kie.ai API)

The client defaults below were validated against `api.kie.ai` and replace the
pilot's placeholder paths:

| Operation | HTTP | Path | Notes |
| --- | --- | --- | --- |
| Image (4o) | `POST` | `/api/v1/gpt4o-image/generate` | Requires `size` (`1:1` default in the route); no `model` field. |
| Video (Veo) | `POST` | `/api/v1/veo/generate` | Requires `model` (`veo3_fast` default in the route) + `aspect_ratio` (`16:9` default). |
| Music (Suno) | `POST` | `/api/v1/generate` | NOT `/api/v1/suno/generate`. Requires `customMode`, `instrumental`, `model`, `callBackUrl`. |
| Chat (LLM) | `POST` | `/v1/chat/completions` | NOT `/api/v1/chat/completions` (404). OpenAI-compatible, sync. |
| Status | `GET` | `/api/v1/jobs/recordInfo?taskId=...` | Poll until terminal state; success returns `resultUrls`. |

Each create helper still accepts an optional `modelPath` second argument if a
future model needs a different route.

## Notes & differences vs the hustlealliance pilot

| Aspect | Hustle Alliance pilot | This repo (Propiedades) |
| --- | --- | --- |
| Layout | `app/` + `lib/` | `src/app/` + `src/lib/` (`@/*` → `./src/*`) |
| Route namespace | `app/api/admin/kie-ai/*` | `src/app/api/admin/kie-ai/*` |
| Admin guard | `requireAdmin()` / `authErrorResponse()` in `lib/auth/guard` | **No such helper exists here.** Routes call `getCurrentUser()` (from `@/modules/auth/session`) and check `role === "admin"` via the shared `src/app/api/admin/kie-ai/guard.ts`. |
| Env var | `KIE_AI_API_KEY` | **`KIEAI_API_KEY`** — already used by this repo's Kie.ai chat fallback. |
| `server-only` | imported | Package not installed here → client uses a header comment instead (only imported from server modules). |
| Error messages | English | Spanish `{ error }`, consistent with existing routes/actions. |

### Existing AI integration (not modified)

`src/modules/ai/server.ts` already performs Kie.ai **chat completions** as a
fallback behind DeepSeek, using the **same `KIEAI_API_KEY`** and
`KIEAI_MODEL`, with its own OpenAI-compatible `chatCompletion()` that returns
`null` on failure. That module is deliberately left untouched. Differences to
be aware of:

- Its Kie.ai URL is `https://api.kie.ai/<model>/v1/chat/completions`
  (per-model path), whereas the pilot client posts to `/v1/chat/completions`
  (per the model name sent in the body).
- The pilot client (`src/lib/ai/kie-ai.ts`) throws `KieAiError`; the existing
  module degrades to `null`.
- Both coexist without symbol or env conflicts; the new media routes live under
  the `admin` namespace while `modules/ai` powers app features (listing
  descriptions / property scoring).

### Security

The API key stays on the server — routes only proxy it to `api.kie.ai` and
never return it. Endpoints require an authenticated `admin` session.
