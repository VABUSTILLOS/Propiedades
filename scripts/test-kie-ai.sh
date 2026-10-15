#!/usr/bin/env bash
#
# Smoke test para las rutas admin de Kie.ai (src/app/api/admin/kie-ai/*).
#
# Las rutas exigen sesión de administrador. El wrapper server-side
# (src/lib/ai/kie-ai-admin.ts) reenvía la cookie automáticamente; este script
# la manda de forma manual con curl para probar el flujo completo:
#   CHAT (síncrono) → IMAGEN (taskId) → polling de STATUS hasta el estado final.
#
# Cómo obtener la cookie de admin:
#   1. Inicia sesión en la app como administrador (en el navegador).
#   2. Abre DevTools → Application → Cookies → tu dominio (localhost:3000).
#   3. Copia la cookie `sb-<ref>-auth-token` en formato `nombre=valor`.
#   4. Guárdala en un archivo (por defecto /tmp/kie-cookie.txt):
#        echo "sb-xxxx-auth-token=eyJ..." > /tmp/kie-cookie.txt
#
# Uso:
#   scripts/test-kie-ai.sh
#   BASE=http://localhost:3000 COOKIE_FILE=/tmp/kie-cookie.txt scripts/test-kie-ai.sh
#
# Requiere: curl y python3.
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
COOKIE_FILE="${COOKIE_FILE:-/tmp/kie-cookie.txt}"

if [ ! -s "$COOKIE_FILE" ]; then
  echo "No encontré la cookie en $COOKIE_FILE." >&2
  echo "Cópiala de DevTools → Application → Cookies (sb-<ref>-auth-token como nombre=valor)." >&2
  exit 1
fi

COOKIE=$(tr -d '\r\n' < "$COOKIE_FILE")

post() {
  local path="$1"
  local payload="$2"
  curl -sf -X POST "$BASE$path" \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d "$payload"
}

get() {
  local path="$1"
  curl -sf "$BASE$path" \
    -H "Cookie: $COOKIE"
}

echo "==> Paso 1: chat síncrono (POST /api/admin/kie-ai/chat)"
CHAT=$(post /api/admin/kie-ai/chat '{
  "model": "gemini-2.5-flash",
  "messages": [{ "role": "user", "content": "Hola, responde solo: OK" }]
}')
echo "$CHAT" | python3 -m json.tool
echo

echo "==> Paso 2: imagen asíncrona (POST /api/admin/kie-ai/image)"
IMAGE=$(post /api/admin/kie-ai/image '{
  "prompt": "Casa colonial en San Miguel de Allende al atardecer, foto realista",
  "size": "1:1"
}')
echo "$IMAGE" | python3 -m json.tool
TASK_ID=$(echo "$IMAGE" | python3 -c 'import json, sys; print(json.load(sys.stdin)["taskId"])')
echo

echo "==> Paso 3: polling de estado (GET /api/admin/kie-ai/status?taskId=$TASK_ID)"
# La ruta devuelve el `record` directamente; por robustez también se soporta
# un eventual envoltorio `{ record }`.
ATTEMPTS=15
for ((i = 1; i <= ATTEMPTS; i++)); do
  sleep 2
  STATUS=$(get "/api/admin/kie-ai/status?taskId=$TASK_ID")
  STATE=$(echo "$STATUS" | python3 -c '
import json, sys
data = json.load(sys.stdin)
record = data["record"] if isinstance(data, dict) and "record" in data else data
print(record.get("state", ""))
')
  echo "  intento $i/$ATTEMPTS — estado: $STATE"

  case "$(echo "$STATE" | tr '[:upper:]' '[:lower:]')" in
    success)
      echo
      echo "==> Tarea completada."
      echo "$STATUS" | python3 -m json.tool
      exit 0
      ;;
    fail | failed | error)
      echo
      echo "==> La tarea terminó en error: $STATUS" >&2
      exit 1
      ;;
  esac
done

echo "==> Timeout: la tarea no llegó a un estado final tras ${ATTEMPTS}x2s." >&2
exit 1
