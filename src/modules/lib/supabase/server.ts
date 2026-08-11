import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/modules/lib/env";
import type { Database } from "@/modules/lib/database.types";

/**
 * Server-side Supabase client that reads the session from cookies.
 * Can be used in Server Components, Server Actions and Route Handlers.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component. Safe to ignore when middleware
            // already refreshes sessions.
          }
        },
      },
    },
  );
}
