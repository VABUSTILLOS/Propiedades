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
#   2. Creates a project in the first available org (default region
#      us-east-1, nearest US region to Mexico City) if none exists
#   3. Links the local repo to the project
#   4. Pushes migrations 001 → 004 (tables, RLS, triggers, indexes)
#   5. Prints the env vars to add to Vercel + guidance for auth config
#
# Requires: Node 18+, network access. Uses `npx supabase` (no global install).
set -euo pipefail

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
PROJECT_NAME="${PROJECT_NAME:-propiedades-marketplace}"
# Valid regions: ap-east-1, ap-northeast-1/2, ap-south-1, ap-southeast-1/2,
# ca-central-1, eu-central-1/2, eu-north-1, eu-west-1/2/3, sa-east-1,
# us-east-1, us-east-2, us-west-1, us-west-2
REGION="${REGION:-us-east-1}" # nearest US region to Mexico City
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 16)}"
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
PROJECT_REF="$($SUPABASE projects list --output-format json 2>/dev/null | \
  node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8"));const arr=p.projects||(Array.isArray(p)?p:[]);const x=arr.find((r)=>r.name===process.env.PROJECT_NAME);process.stdout.write(x?(x.ref||x.id||""):"")')"
PROJECT_NAME="$PROJECT_NAME"

if [[ -z "$PROJECT_REF" ]]; then
  echo "==> Resolving organization..."
  ORG_ID="$($SUPABASE orgs list --output-format json 2>/dev/null | \
    node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8"));const arr=p.orgs||p.organizations||(Array.isArray(p)?p:[]);process.stdout.write((arr[0]&&(arr[0].id||""))||"")')"

  if [[ -z "$ORG_ID" ]]; then
    echo "ERROR: Could not resolve an organization ID. Set one explicitly:" >&2
    echo "  ORG_ID=your-org-id bash scripts/setup-supabase.sh" >&2
    echo "Find it with: npx -y supabase orgs list" >&2
    exit 1
  fi

  echo "==> Creating project '$PROJECT_NAME' in $REGION (org $ORG_ID)..."
  CREATE_OUT="$($SUPABASE projects create "$PROJECT_NAME" \
    --org-id "$ORG_ID" --region "$REGION" --db-password "$DB_PASSWORD" \
    --output-format json 2>/dev/null || true)"

  PROJECT_REF="$(printf '%s' "$CREATE_OUT" | \
    node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write((p.ref||p.id||p.project_ref||"")||"")' 2>/dev/null || \
    printf '%s' "$CREATE_OUT" | \
    node -e 'const m=require("fs").readFileSync(0,"utf8").match(/([a-z0-9]{20,})/i);process.stdout.write(m?m[1]:"")')"
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
