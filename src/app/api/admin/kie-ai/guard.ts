import { NextResponse } from "next/server";

import { getCurrentUser, type AuthUser } from "@/modules/auth/session";

/**
 * Admin guard for the Kie.ai pilot API routes.
 *
 * Adapts the hustlealliance pilot's `requireAdmin()` helper to this repo's
 * conventions: this repo has no shared `requireAdmin`, so routes rely on
 * `getCurrentUser()` (see `src/modules/auth/session.ts`) plus an explicit
 * role check — the same pattern used across the codebase (e.g. admin pages).
 *
 * Returns a typed union: `{ ok: true; user }` on success, or a ready-to-return
 * NextResponse on failure. The route must return early on the `response` arm.
 */
export async function requireKieAiAdmin(): Promise<
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  if (user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solo el usuario administrador puede usar esta ruta." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user };
}
