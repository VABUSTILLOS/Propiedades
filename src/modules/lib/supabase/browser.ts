import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/modules/lib/env";
import type { Database } from "@/modules/lib/database.types";

/**
 * Browser-side Supabase client. Must only be imported from Client Components.
 * Uses the anon key — RLS is the primary security boundary.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
  );
}
