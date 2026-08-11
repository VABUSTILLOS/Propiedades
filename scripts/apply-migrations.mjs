#!/usr/bin/env node
/**
 * Token-free migration runner for Supabase.
 *
 * Applies supabase/migrations/*.sql directly to a Supabase database using the
 * project's connection string — no SUPABASE_ACCESS_TOKEN required. Use this
 * when you want to reuse an existing Supabase project instead of creating a
 * new one (free plan allows max 2 projects).
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
 *     node scripts/apply-migrations.mjs
 *
 * Get the connection string at:
 *   https://supabase.com/dashboard/project/<ref>/settings/database
 *   (Settings → Database → Connection string → "URI". Use the session-mode
 *    connection on port 5432, not the transaction-mode pooler on 6543 —
 *    migrations need a single persistent connection.)
 *
 * The script applies migrations in filename order, each inside its own
 * transaction. Partial failures roll back the failing migration only.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
);

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error(
    "ERROR: DATABASE_URL is required.\n" +
      "Get the connection string from Supabase dashboard → Settings → Database → Connection string,\n" +
      'then run: DATABASE_URL="postgresql://..." node scripts/apply-migrations.mjs',
  );
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1|::1/.test(DATABASE_URL);
const ssl = isLocal ? false : { rejectUnauthorized: false };
const client = new Client({ connectionString: DATABASE_URL, ssl });

async function main() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.error(`No migrations found in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  console.log(`Connecting to Supabase Postgres…`);
  await client.connect();
  console.log("Connected.\n");

  let applied = 0;
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`==> Applying ${file} …`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`    OK (${sql.length} bytes)\n`);
      applied += 1;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`    FAILED: ${err.message}\n`);
      throw new Error(`Migration ${file} failed; rollback complete. Fix and re-run.`);
    }
  }

  console.log(`Done: ${applied}/${files.length} migrations applied.`);
  console.log(
    "\nNext: copy the Project URL + anon key from\n" +
      "dashboard → Settings → API, then add to Vercel:\n" +
      "  npx vercel env add NEXT_PUBLIC_SUPABASE_URL <project-url>\n" +
      "  npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY <anon-key>\n" +
      "  npx vercel env add NEXT_PUBLIC_SITE_URL https://vabustillos-scaling-potato.vercel.app\n" +
      "Then redeploy: npx vercel --prod --yes",
  );
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end().catch(() => {}));
