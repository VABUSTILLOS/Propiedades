#!/usr/bin/env node
// =============================================================================
// provision-supabase.mjs — create a Supabase project for Propiedades end-to-end.
//
//   npm run create:supabase -- --token <personal-access-token>
//   SUPABASE_ACCESS_TOKEN=xxx npm run create:supabase
//
// Steps (automated):
//   1. Authenticate with the personal access token (stored in ~/.supabase).
//   2. Pick the org (--org-id, or the first accessible org).
//   3. Create the project (name `propiedades`, region us-east-1, strong random
//      DB password generated locally).
//   4. Wait until the project is ACTIVE.
//   5. Fetch anon + service_role keys (--reveal).
//   6. Write NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
//      SUPABASE_DB_URL into .env.local (fills the blanks, keeps other keys).
//   7. Print next steps (npm run setup:db, deploy edge fn, npm run dev).
//
// Everything is idempotent: if a project already exists and --project-ref or a
// URL is already in .env.local, the script can fill in keys for that project
// instead of creating a new one.
// =============================================================================
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env.local");
const SUPABASE = "~/.local/bin/supabase"; // npm global symlink target

// ── helpers ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { token: "", orgId: "", projectRef: "", region: "us-east-1", name: "propiedades", yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--token") args.token = argv[++i] ?? "";
    else if (a === "--org-id") args.orgId = argv[++i] ?? "";
    else if (a === "--project-ref") args.projectRef = argv[++i] ?? "";
    else if (a === "--region") args.region = argv[++i] ?? "";
    else if (a === "--name") args.name = argv[++i] ?? "";
    else if (a === "--yes") args.yes = true;
  }
  return args;
}

function loadEnv() {
  const env = {};
  if (!existsSync(envFile)) return env;
  for (const raw of readFileSync(envFile, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function sup(cmd, { json = false, env = {} } = {}) {
  const fmt = json ? "--output-format json" : "";
  const cmdStr = `${SUPABASE} ${fmt} ${cmd}`.trim();
  const out = execSync(cmdStr, { encoding: "utf8", env: { ...process.env, ...env } });
  return json ? JSON.parse(out) : out.trim();
}

function asArray(maybe, ...keys) {
  if (Array.isArray(maybe)) return maybe;
  if (maybe && typeof maybe === "object") {
    for (const k of keys) {
      if (Array.isArray(maybe[k])) return maybe[k];
    }
  }
  return [];
}

function randomPassword(len = 24) {
  // Supabase requires: >=10 chars, uppercase, lowercase, number, and a non-alphanumeric char.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  let s = "";
  for (let i = 0; i < len - 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  // guarantee character classes
  s += "Ab1!";
  return s;
}

function patchEnv(updates) {
  if (!existsSync(envFile)) {
    writeFileSync(envFile, "", "utf8");
  }
  const lines = readFileSync(envFile, "utf8").split("\n");
  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx !== -1) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(envFile, lines.join("\n") + "\n", "utf8");
  console.log(`✔ ${envFile}:  ${Object.keys(updates).join(", ")} written`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
const env = loadEnv();

console.log("→ Propiedades · Supabase provisioning\n");

// 0. Locate the CLI.
const cli = SUPABASE.replace("~", homedir());
if (!existsSync(cli)) {
  console.error(`✗ Supabase CLI not found at ${cli}\n  Install: npm install -g supabase`);
  process.exit(1);
}

// 1. Token.
let token = args.token || process.env.SUPABASE_ACCESS_TOKEN || "";
if (!token) {
  if (!process.stdin.isTTY) {
    console.error(
      "✗ No SUPABASE_ACCESS_TOKEN provided and stdin is not interactive.\n\n" +
        "  1. Generate a token at https://supabase.com/dashboard/account/tokens\n" +
        "  2. Re-run with it:\n" +
        "       SUPABASE_ACCESS_TOKEN=sbp_xxx npm run create:supabase\n" +
        "     or\n" +
        "       npm run create:supabase -- --token sbp_xxx",
    );
    process.exit(1);
  }
  const resp = await prompt(
    "Paste your Supabase personal access token (https://supabase.com/dashboard/account/tokens):\n> ",
  );
  token = resp;
}
if (!token || token.length < 20) {
  console.error("✗ A valid personal access token is required.");
  process.exit(1);
}
console.log("✔ Authenticating…");
try {
  sup(`login --token ${token}`);
} catch (err) {
  console.error("✗ Supabase authentication failed.\n" + String(err.stdout || err.message));
  process.exit(1);
}

// 2. Reuse an existing project if a URL is already configured.
let projectRef = args.projectRef || (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/^https?:\/\//, "").split(".")[0] || "";
let orgId = args.orgId;
let created = null;
let dbPassword = "";

if (!projectRef) {
  const orgs = asArray(sup("orgs list", { json: true }), "orgs", "organizations");
  if (orgs.length === 0) {
    console.error("✗ No organizations found. Create one at https://supabase.com/dashboard/new");
    process.exit(1);
  }
  orgId = orgId || orgs[0].id;
  const org = orgs.find((o) => o.id === orgId) ?? orgs[0];
  console.log(`✔ Organization: ${org.name} (${org.id})`);

  dbPassword = randomPassword();
  console.log(`✔ Creating project "${args.name}" in ${args.region}…`);
  try {
    created = sup(
      `projects create ${args.name} --org-id ${org.id} --db-password ${dbPassword} --region ${args.region} --yes`,
      { json: true },
    );
  } catch (err) {
    const msg = String(err.stdout || err.message);
    const already = msg.match(/already exists|name already taken/i);
    if (already) {
      console.error("✗ A project named", args.name, "already exists.\n  Re-run with --project-ref <ref> to reuse it.");
      process.exit(1);
    }
    console.error("✗ Failed to create project:\n", msg);
    process.exit(1);
  }
  projectRef = created.id || created.ref;
  console.log(`✔ Project ref: ${projectRef}`);
  // 3. Wait for the project to become active.
  console.log("⏳ Waiting for project to become active…");
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(10000);
    try {
      const list = asArray(sup("projects list", { json: true }), "projects");
      const proj = list.find((p) => p.id === projectRef || p.ref === projectRef);
      const status = proj?.status || proj?.region; // some CLIs don't surface status
      // Accept any "ACTIVE…" status (ACTIVE, ACTIVE_HEALTHY, ACTIVE_RESIZING…) plus
      // CLIs that never surface status at all.
      if (proj && (String(status).toUpperCase().startsWith("ACTIVE") || !proj.status)) {
        ready = true;
        break;
      }
      if (i % 5 === 4) console.log(`  … still provisioning (${Math.min(i + 1, 60)}/60)…`);
    } catch {
      // transient CLI errors during provisioning are fine — keep polling
    }
  }
  if (!ready) {
    console.error("✗ Project did not become active within 10 minutes.\n  Check https://supabase.com/dashboard");
    process.exit(1);
  }
  console.log("✔ Project is active.");
}

// 4. Fetch API keys.
console.log("✔ Fetching API keys…");
let keys = asArray(sup(`projects api-keys --project-ref ${projectRef} --reveal`, { json: true }), "api_keys", "keys");
const anon = keys.find((k) => k.name === "anon")?.api_key ?? "";
const serviceRole = keys.find((k) => k.name === "service_role")?.api_key ?? "";
if (!anon) {
  console.error("✗ Could not fetch API keys for", projectRef);
  process.exit(1);
}
console.log(`✔ anon key / service_role key fetched`);

// 5. Build the DB URL.
const projectUrl = `https://${projectRef}.supabase.co`;
// The CLI's create response includes a direct host on newer versions; fall back
// to the classic direct endpoint.
let dbHost = "";
try {
  const details = asArray(sup(`projects list`, { json: true }), "projects");
  const proj = details.find((p) => p.id === projectRef || p.ref === projectRef);
  dbHost = proj?.database?.host ?? `${projectRef}.supabase.co`;
} catch {
  dbHost = `${projectRef}.supabase.co`;
}
dbPassword = dbPassword || env.SUPABASE_DB_PASSWORD || created?.database?.password || "";

console.log("");
console.log("Writing keys to .env.local…");
patchEnv({
  NEXT_PUBLIC_SUPABASE_URL: projectUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
});

if (serviceRole) {
  patchEnv({ SUPABASE_SERVICE_ROLE_KEY: serviceRole });
}

if (!env.SUPABASE_DB_URL && dbPassword) {
  patchEnv({
    SUPABASE_DB_URL: `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@${dbHost}:5432/postgres`,
    SUPABASE_DB_PASSWORD: dbPassword,
  });
}

console.log(
  "\nNext steps:\n" +
    "  1. Apply migrations:\n" +
    "       npm run setup:db\n" +
    "  (or paste supabase/migrations/_ALL_IN_ONE.sql into the SQL Editor)\n" +
    "  2. Deploy the AI edge function:\n" +
    "       supabase functions deploy import-property-ai\n" +
    "  3. Start the app:\n" +
    "       npm run dev\n" +
    "  4. Sign up (seed: demo@propiedades.mx / demo12345) and validate.\n",
);
