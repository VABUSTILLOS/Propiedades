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
   ```

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

```bash
curl -s -X POST http://localhost:3000/api/admin/kie-ai/image \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"Modern penthouse terrace at sunset in Mexico City, photorealistic"}'
# → {"taskId":"..."}
```

### Poll task status

```bash
curl -s "http://localhost:3000/api/admin/kie-ai/status?taskId=TASK_ID" \
  -H "Cookie: $COOKIE"
# → { "taskId": "...", "state": "success", "resultJson": "..." }
```

`state` transitions through `waiting` / `queuing` / `generating` to
`success` or `fail`. The client also ships `pollTaskUntilComplete(taskId)` for
server-side blocking (not exposed as a route).

### Video and music

Same shape as image, different model endpoints:

```bash
curl -s -X POST http://localhost:3000/api/admin/kie-ai/video \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"Aerial drone tour of a colonial villa in San Miguel de Allende"}'

curl -s -X POST http://localhost:3000/api/admin/kie-ai/music \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"prompt":"Soft acoustic chillhop, 60 BPM"}'
```

### Chat (synchronous)

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
  pollTaskUntilComplete,
  chatCompletion,
  listModels,
  isKieAiConfigured,
} from "@/lib/ai/kie-ai";

if (isKieAiConfigured()) {
  const { taskId } = await createImageTask({ prompt: "…" });
  const done = await pollTaskUntilComplete(taskId, { timeoutMs: 60_000 });
  // done.resultJson / done.failMsg
}
```

## Model paths (⚠️ verify per docs)

The client's default generation endpoints are placeholders copied from the
pilot. Confirm the correct per-model route for your account in the
[docs.kie.ai](https://docs.kie.ai/) model reference and override if needed:

```ts
createImageTask({ prompt }, "/api/v1/<your-image-model>/generate");
```

Every create helper accepts an optional `modelPath` as its second argument, and
the routes accept an optional `model` field that is forwarded into the request
body.

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
  (per-model path), whereas the pilot client posts to `/api/v1/chat/completions`.
- The pilot client (`src/lib/ai/kie-ai.ts`) throws `KieAiError`; the existing
  module degrades to `null`.
- Both coexist without symbol or env conflicts; the new media routes live under
  the `admin` namespace while `modules/ai` powers app features (listing
  descriptions / property scoring).

### Security

The API key stays on the server — routes only proxy it to `api.kie.ai` and
never return it. Endpoints require an authenticated `admin` session.
