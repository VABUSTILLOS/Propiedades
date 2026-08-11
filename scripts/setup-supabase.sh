#!/usr/bin/env bash
#
# One-shot Supabase provisioning for Propiedades.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/setup-supabase.sh
#
# Or export SUPABASE_ACCESS_TOKEN first, then just run the script.
#
# What it does:
#   1. Logs into Supabase (writes ~/.supabase/access-token)
#   2. Creates a project (region near Mexico: eastus2) if none exists
#   3. Links the local repo to the project
#   4. Pushes migrations 001 → 004 (tables, RLS, triggers, indexes)
#   5. Prints the env vars to add to Vercel + guidance for auth config
#
# Requires: Node 18+, network access. Uses `npx supabase` (no global install).
set -euo pipefail

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
PROJECT_NAME="${PROJECT_NAME:-propiedades-marketplace}"
REGION="${REGION:-eastus2}" # nearest to Mexico City (northcentralus is alt)
SITE_URL="${SITE_URL:-https://vabustillos-scaling-potato.vercel.app}"

if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is required." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens then re-run:" >&2
  echo "  SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/setup-supabase.sh" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SUPABASE="npx -y supabase"

echo "==> Logging into Supabase..."
$SUPABASE login --access-token "$SUPABASE_ACCESS_TOKEN"

echo "==> Checking for an existing project..."
PROJECT_REF="$($SUPABASE projects list --json 2>/dev/null | \
  node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8"));const x=(p.projects||p).find((r)=>r.name===process.env.PROJECT_NAME||r.name==="propiedades-marketplace");process.stdout.write(x?x.ref:"")')"
PROJECT_NAME="$PROJECT_NAME"

if [[ -z "$PROJECT_REF" ]]; then
  echo "==> Creating project '$PROJECT_NAME' in $REGION..."
  PROJECT_REF="$($SUPABASE projects create "$PROJECT_NAME" --org-id "" --region "$REGION" 2>/dev/null | \
    node -e 'const m=require("fs").readFileSync(0,"utf8").match(/ref[:\s]+([a-z0-9]{20,})/i);process.stdout.write(m?m[1]:"")')"
  # Fallback: create returns the ref as the last token of the JSON output.
  if [[ -z "$PROJECT_REF" ]]; then
    PROJECT_REF="$($SUPABASE projects create "$PROJECT_NAME" --region "$REGION" --json 2>/dev/null | \
      node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(p.ref||p.id||"")')"
  fi
fi

if [[ -z "$PROJECT_REF" ]]; then
  echo "ERROR: Could not determine the project ref. Create it manually:" >&2
  echo "  npx -y supabase projects create" >&2
  echo "  npx -y supabase link --project-ref <REF>" >&2
  exit 1
fi

echo "==> Project ref: $PROJECT_REF"
echo "==> Linking repo to project..."
$SUPABASE link --project-ref "$PROJECT_REF" --yes

echo "==> Pushing migrations (001-004)..."
$SUPABASE db push --yes

echo ""
echo "=============================================================="
echo "Supabase provisioned. Next steps (Vercel env vars):"
echo "=============================================================="
echo "URL:    https://$PROJECT_REF.supabase.co"
echo "ANON:   get from https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
echo ""
echo "Add to Vercel (production):"
echo "  npx vercel env add NEXT_PUBLIC_SUPABASE_URL    https://$PROJECT_REF.supabase.co"
echo "  npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY <anon-key>"
echo "  npx vercel env add NEXT_PUBLIC_SITE_URL        $SITE_URL"
echo ""
echo "Auth config (dashboard https://supabase.com/dashboard/project/$PROJECT_REF/auth/url-configuration):"
echo "  Site URL:        $SITE_URL"
echo "  Redirect URLs:   $SITE_URL/**, http://localhost:3000/**"
echo ""
echo "Then redeploy: npx vercel --prod --yes"
echo "Note: password reset needs /auth/update-password route (not built yet)."
