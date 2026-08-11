import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/modules/lib/env";
import type { Database } from "@/modules/lib/database.types";

/**
 * Edge runtime Supabase client used by middleware.ts to refresh sessions.
 * Returns null when Supabase is not configured so the site can render
 * (e.g. before env vars are added) instead of crashing every request.
 */
export async function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!env.supabaseConfigured) {
    return { supabase: null, response };
  }

  const supabase = createServerClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  return { supabase, response };
}
