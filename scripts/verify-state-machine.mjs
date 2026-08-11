#!/usr/bin/env node
/**
 * Anti-drift check: the transaction state machine in the app must match the
 * graph enforced by the DB trigger (supabase/migrations/003_computational_logic.sql,
 * public.validate_transaction_transition()). SQL is the source of truth.
 *
 * Usage: node scripts/verify-state-machine.mjs
 * Exits 1 with a diff when the two graphs diverge.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = resolve(root, "supabase/migrations/003_computational_logic.sql");
const tsPath = resolve(root, "src/modules/transactions/state-machine.ts");

const sql = readFileSync(sqlPath, "utf8");
const ts = readFileSync(tsPath, "utf8");

/** Parse the CASE block in the SQL trigger into { state: [targets] }. */
function parseSqlTransitions(source) {
  const caseMatch = source.match(
    /allowed_states\s*:?=\s*CASE\s+OLD\.state([\s\S]*?)END\s*;/,
  );
  if (!caseMatch) throw new Error("Could not locate CASE block in SQL trigger.");

  const transitions = {};
  const whenRe = /WHEN\s+'([a-z_]+)'\s+THEN\s+ARRAY\[([^\]]*)\]/g;
  let m;
  while ((m = whenRe.exec(caseMatch[1])) !== null) {
    const targets = m[2]
      .split(",")
      .map((t) => t.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
    transitions[m[1]] = targets;
  }
  return transitions;
}

/** Parse ALLOWED_TRANSITIONS in the TS module into { state: [targets] }. */
function parseTsTransitions(source) {
  const objMatch = source.match(
    /ALLOWED_TRANSITIONS:\s*Record<TransactionState,\s*TransactionState\[\]>\s*=\s*\{([\s\S]*?)\};/,
  );
  if (!objMatch) throw new Error("Could not locate ALLOWED_TRANSITIONS in TS.");

  const transitions = {};
  const entryRe = /([a-z_]+):\s*\[([^\]]*)\]/g;
  let m;
  while ((m = entryRe.exec(objMatch[1])) !== null) {
    const targets = m[2]
      .split(",")
      .map((t) => t.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    transitions[m[1]] = targets;
  }
  return transitions;
}

const sqlTransitions = parseSqlTransitions(sql);
const tsTransitions = parseTsTransitions(ts);

// States not listed in the SQL CASE fall through to ELSE (terminal, empty).
const allStates = new Set([...Object.keys(sqlTransitions), ...Object.keys(tsTransitions)]);
const failures = [];

for (const state of allStates) {
  const sqlTargets = (sqlTransitions[state] ?? []).slice().sort();
  const tsTargets = (tsTransitions[state] ?? []).slice().sort();
  if (JSON.stringify(sqlTargets) !== JSON.stringify(tsTargets)) {
    failures.push(
      `  ${state}:\n` +
        `    SQL expects -> ${JSON.stringify(sqlTargets)}\n` +
        `    App has    -> ${JSON.stringify(tsTargets)}`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    "State machine drift detected between DB trigger and app (SQL is source of truth):\n" +
      failures.join("\n"),
  );
  process.exit(1);
}

console.log("OK: app state machine matches SQL trigger (003_computational_logic.sql).");
