#!/usr/bin/env node
// =============================================================================
// gen-all-in-one.mjs — regenerate supabase/migrations/_ALL_IN_ONE.sql
// by concatenating every numbered migration (0*.sql) in filename order.
//
// The combined file exists so users can apply ALL migrations in one shot via
// the Supabase SQL Editor (zero tooling). Run after adding a new migration:
//   npm run gen:migrations
// =============================================================================
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => /^0\d+_.*\.sql$/.test(f)).sort();

const header = `-- ============================================================
-- _ALL_IN_ONE.sql — GENERATED FILE. Do not edit by hand.
-- Run \`npm run gen:migrations\` to regenerate after adding a migration.
-- Concatenation of every numbered migration in order, for one-shot
-- application via the Supabase SQL Editor (or the setup-db runner).
-- ============================================================

`;

let out = header;
for (const file of files) {
  out += `-- ============================================================\n`;
  out += `-- SOURCE: ${file}\n`;
  out += `-- ============================================================\n`;
  out += await readFile(join(dir, file), "utf8");
  out += "\n\n";
}

await writeFile(join(dir, "_ALL_IN_ONE.sql"), out, "utf8");
console.log(`✔ Regenerated _ALL_IN_ONE.sql from ${files.length} migrations (${out.split("\n").length} lines).`);
