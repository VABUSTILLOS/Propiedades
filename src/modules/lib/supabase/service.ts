import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/modules/lib/env";
import type { Database } from "@/modules/lib/database.types";

/**
 * Privileged Supabase client (service role, bypasses RLS). Server-side only:
 * used by webhooks and token-gated intake routes where there is no user
 * session. Never import from client components — the key must not leak.
 */
let _serviceClient: SupabaseClient<Database> | null = null;

export function createSupabaseServiceClient(): SupabaseClient<Database> {
  if (!_serviceClient) {
    _serviceClient = createClient<Database>(
      env.supabaseUrl,
      env.supabaseServiceRoleKey,
      { auth: { persistSession: false } },
    );
  }
  return _serviceClient;
}

export function serviceRoleConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}
