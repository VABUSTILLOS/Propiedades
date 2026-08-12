#!/usr/bin/env bash
#
# Creates the approved Meta message template used by /api/chat/send-whatsapp
# for cold contacts (visitor numbers outside the 24h window).
#
# Prereqs in .env.local:
#   WHATSAPP_ACCESS_TOKEN   — PERMANENT system-user token (the temporary
#                             Quickstart token expires in 24h and can't do this)
#   WHATSAPP_PHONE_NUMBER_ID
#
# Usage:
#   scripts/create-whatsapp-results-template.sh [WABA_ID]
#
# WABA_ID is optional — the script tries to discover it from the token's
# businesses. Find it manually in Meta Business Settings → Accounts →
# WhatsApp accounts.
set -euo pipefail

cd "$(dirname "$0")/.."

TOKEN=$(grep '^WHATSAPP_ACCESS_TOKEN=' .env.local | cut -d= -f2-)
PNID=$(grep '^WHATSAPP_PHONE_NUMBER_ID=' .env.local | cut -d= -f2-)
TEMPLATE_NAME=$(grep '^WHATSAPP_RESULTS_TEMPLATE_NAME=' .env.local | cut -d= -f2-)
TEMPLATE_NAME=${TEMPLATE_NAME:-propiedades_resultados}

if [ -z "$TOKEN" ] || [ -z "$PNID" ]; then
  echo "Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID en .env.local" >&2
  exit 1
fi

WABA_ID="${1:-}"

if [ -z "$WABA_ID" ]; then
  echo "Descubriendo el WhatsApp Business Account ID…"
  BIZ=$(curl -sf "https://graph.facebook.com/v23.0/me/businesses" \
    -H "Authorization: Bearer $TOKEN" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["data"][0]["id"])' || true)
  if [ -n "$BIZ" ]; then
    WABA_ID=$(curl -sf "https://graph.facebook.com/v23.0/$BIZ/owned_whatsapp_business_accounts" \
      -H "Authorization: Bearer $TOKEN" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["data"][0]["id"])' || true)
  fi
fi

if [ -z "$WABA_ID" ]; then
  echo "No pude descubrir el WABA ID. Pásalo como argumento:" >&2
  echo "  $0 <WABA_ID>" >&2
  exit 1
fi

# IMAGE header templates require an `example.header_handle` from Meta's
# Resumable Upload API — a plain public URL is rejected (error 2388273).
# Upload the sample image first to get a handle.
EXAMPLE_IMAGE_URL="https://qfemrfrkxfirpizwcalh.supabase.co/storage/v1/object/public/property-images/68c8b3ab-5471-4755-bd17-0f78067857dc/0.jpg"
APP_ID="920084177810670"

TMP_IMG=$(mktemp /tmp/template-sample.XXXXXX.jpg)
trap 'rm -f "$TMP_IMG"' EXIT
curl -sf -o "$TMP_IMG" "$EXAMPLE_IMAGE_URL"
IMG_SIZE=$(stat -f%z "$TMP_IMG" 2>/dev/null || stat -c%s "$TMP_IMG")

UPLOAD_ID=$(curl -sf -X POST "https://graph.facebook.com/v23.0/$APP_ID/uploads" \
  --data-urlencode "file_name=sample.jpg" \
  --data-urlencode "file_length=$IMG_SIZE" \
  --data-urlencode "file_type=image/jpeg" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

HANDLE=$(curl -sf -X POST "https://graph.facebook.com/v23.0/$UPLOAD_ID" \
  -H "Authorization: OAuth $TOKEN" \
  -H "file_offset: 0" \
  --data-binary "@$TMP_IMG" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["h"])')

echo "Creando plantilla '$TEMPLATE_NAME' en WABA ${WABA_ID}…"
curl -sf -X POST "https://graph.facebook.com/v23.0/$WABA_ID/message_templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'"$TEMPLATE_NAME"'",
    "category": "UTILITY",
    "language": "es_MX",
    "components": [
      {
        "type": "HEADER",
        "format": "IMAGE",
        "example": {
          "header_handle": ["'"$HANDLE"'"]
        }
      },
      {
        "type": "BODY",
        "text": "¡Hola! 👋 Estas son las propiedades que buscaste:\n\n{{1}}\n\nResponde a este mensaje para seguir buscando aquí mismo. Escribe \"asesor\" si prefieres que te atienda una persona.",
        "example": {
          "body_text": [
            ["1. Casa en venta. Centro, Chihuahua por $2,500,000 MXN.\n   Más info: https://ejemplo.com/property/casa-centro"]
          ]
        }
      }
    ]
  }'

echo
echo "Listo. Meta debe APROBAR la plantilla (minutos u horas). Verifica con:"
echo "  curl -s \"https://graph.facebook.com/v23.0/$WABA_ID/message_templates?name=$TEMPLATE_NAME\" -H \"Authorization: Bearer \$TOKEN\""
