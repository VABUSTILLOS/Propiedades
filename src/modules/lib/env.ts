/**
 * Centralized, type-safe environment variable access.
 * All reads go through this module so typos and missing keys are caught at boot.
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseConfigured: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  kieaiApiKey: process.env.KIEAI_API_KEY ?? "",
  kieaiModel: process.env.KIEAI_MODEL ?? "gemini-2.5-flash",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  googleMapsMapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "",
  googleMapsServerKey:
    process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL ?? "",
  whatsappVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappGraphToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? "",
} as const;

export function requireEnv(scope: "client" | "server" = "client"): void {
  if (scope === "client") {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new Error(
        "Missing Supabase env vars. Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
    return;
  }
  if (!env.supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. It is required for server-side privileged operations.",
    );
  }
}
