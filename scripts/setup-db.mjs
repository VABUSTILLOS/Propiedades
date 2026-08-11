#!/usr/bin/env node
// =============================================================================
// setup-db.mjs — one-command Supabase setup: apply migrations + print next steps.
//
//   npm run setup:db
//
// Reads `.env.local` for NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// and SUPABASE_DB_URL / DATABASE_URL (optional direct connection string).
//
// Resolution order:
//   1. SUPABASE_DB_URL / DATABASE_URL  → applies all migrations via the token-free
//      runner `scripts/apply-migrations.mjs` (each file in its own transaction).
//   2. supabase CLI                    → `supabase link` + `supabase db push`.
//   3. Fallback                        → prints the zero-tooling SQL-Editor path
//      using `supabase/migrations/_ALL_IN_ONE.sql`.
// =============================================================================
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFile = join(root, "supabase", "migrations", "_ALL_IN_ONE.sql");

function loadEnv() {
  const env = {};
  for (const file of [join(root, ".env.local"), join(root, ".env")]) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  return env;
}

function has(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

function printPostSteps() {
  console.log(
    "\nNext steps:\n" +
      "  1. Deploy the AI edge function:\n" +
      "       supabase functions deploy import-property-ai\n" +
      "  2. Add optional keys to .env.local (AI / maps / alerts):\n" +
      "       DEEPSEEK_API_KEY, GOOGLE_MAPS_SERVER_KEY, OPENAI_API_KEY,\n" +
      "       WHATSAPP_WEBHOOK_URL, JINA_API_KEY\n" +
      "  3. Start the app:\n" +
      "       npm run dev\n",
  );
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL ?? "";

console.log("→ Propiedades database setup\n");

if (!url || !anonKey) {
  console.error(
    "✗ Missing Supabase credentials.\n\n" +
      "  1. Create a project at https://supabase.com/dashboard\n" +
      "  2. Copy `.env.example` → `.env.local`\n" +
      "  3. Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Settings → API)\n" +
      "  4. Re-run: npm run setup:db",
  );
  process.exit(1);
}

const projectRef = url.replace(/^https?:\/\//, "").split(".")[0];
console.log(`✔ Project URL: ${url}`);
console.log(`  Project ref: ${projectRef}`);
console.log(
  `  Migrations: ${migrationsFile.replace(root + "/", "")} (${existsSync(migrationsFile) ? readFileSync(migrationsFile, "utf8").split("\n").length : "?"} lines)\n`,
);

// Path 1: direct connection string → token-free runner (recommended).
if (dbUrl) {
  run(`DATABASE_URL="${dbUrl}" node scripts/apply-migrations.mjs`);
  printPostSteps();
  process.exit(0);
}

// Path 2: supabase CLI.
if (has("supabase")) {
  console.log("✔ supabase CLI detected.\n");
  const ref = env.SUPABASE_PROJECT_REF ?? projectRef;
  run(`supabase link --project-ref ${ref}`);
  run("supabase db push");
  printPostSteps();
  process.exit(0);
}

// Path 3: fallback — SQL Editor with the combined file.
console.log(
  "No SUPABASE_DB_URL / DATABASE_URL and no `supabase` CLI found.\n\n" +
    "Simplest path — Supabase SQL Editor (zero tooling):\n" +
    "  1. Open your project dashboard → SQL Editor → New query\n" +
    "  2. Paste the full contents of:\n" +
    "       supabase/migrations/_ALL_IN_ONE.sql\n" +
    "  3. Run. Applies all 10 migrations in order (idempotent-safe).\n\n" +
    "Recommended local path — direct connection:\n" +
    "  1. Supabase dashboard → Settings → Database → Connection string → copy URI\n" +
    "  2. Add to .env.local:  SUPABASE_DB_URL=\"postgresql://...\"\n" +
    "  3. Re-run:  npm run setup:db\n" +
    "  (each migration applies in its own transaction; failures roll back only that file)\n",
);
printPostSteps();
process.exit(0);
