import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Edge functions deploy via Supabase CLI (Deno runtime), not the Next app.
    "supabase/functions/**",
    // Scraper workspace with its own virtualenv (vendored JS crashes the
    // formatter) — not part of the Next.js app.
    "vivanuncios_com_mx/**",
  ]),
]);

export default eslintConfig;
