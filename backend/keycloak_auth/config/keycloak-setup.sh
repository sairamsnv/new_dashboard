#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# keycloak-setup.sh
# Run ONCE after Keycloak starts to create the realm, client, and roles.
#
# Usage:
#   chmod +x keycloak-setup.sh
#   ./keycloak-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Read config.json if it exists ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"

if [ -f "$CONFIG_FILE" ]; then
  KC_URL=$(python3 -c "
import json, sys
d = json.load(open('$CONFIG_FILE'))
url = d['oauthProviderDiscoveryUrl']
print(url.split('/realms/')[0])
")
  KC_REALM=$(python3 -c "
import json
d = json.load(open('$CONFIG_FILE'))
url = d['oauthProviderDiscoveryUrl']
print(url.split('/realms/')[1].split('/')[0])
")
  KC_ADMIN=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('keycloakAdminUsername','admin'))")
  KC_ADMIN_PASS=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('keycloakAdminPassword','admin'))")
  KC_CLIENT_ID=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('oauthAppClientId','analytics-dashboard'))")
  KC_CLIENT_SECRET=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('oauthAppClientSecret',''))")
else
  KC_URL="${KEYCLOAK_SERVER_URL:-http://localhost:8080}"
  KC_REALM="${KEYCLOAK_REALM:-analytics}"
  KC_ADMIN="${KEYCLOAK_ADMIN_USERNAME:-admin}"
  KC_ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
  KC_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-analytics-dashboard}"
  KC_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-}"
fi

echo "────────────────────────────────────────────"
echo "  Keycloak Setup"
echo "  Server : $KC_URL"
echo "  Realm  : $KC_REALM"
echo "  Client : $KC_CLIENT_ID"
echo "────────────────────────────────────────────"

# ── 0. Wait for Keycloak to be reachable ─────────────────────────────────────
echo "[0/5] Checking Keycloak is reachable at $KC_URL ..."
MAX_WAIT=60
WAITED=0
until curl -sf "$KC_URL/health/ready" > /dev/null 2>&1 || \
      curl -sf "$KC_URL/realms/master" > /dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo ""
    echo "ERROR: Keycloak is not reachable at $KC_URL after ${MAX_WAIT}s."
    echo ""
    echo "  Please start Keycloak first, then re-run this script."
    echo "  Option 1 — Docker:"
    echo "    cd $(dirname "$SCRIPT_DIR")/../../.."
    echo "    docker-compose up keycloak -d"
    echo "    # wait ~30 seconds, then re-run"
    echo ""
    echo "  Option 2 — Local install:"
    echo "    keycloak/bin/kc.sh start-dev"
    echo ""
    exit 1
  fi
  echo "   Waiting for Keycloak... (${WAITED}s elapsed)"
  sleep 5
  WAITED=$((WAITED + 5))
done
echo "   ✓ Keycloak is up"

# ── 1. Get admin token ────────────────────────────────────────────────────────
echo "[1/5] Getting admin token..."
TOKEN_RESPONSE=$(curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=admin-cli&username=${KC_ADMIN}&password=${KC_ADMIN_PASS}")

ADMIN_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'access_token' in d:
        print(d['access_token'])
    else:
        print('ERROR: ' + d.get('error_description', d.get('error', 'Unknown error')), file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print('ERROR: Could not parse response: ' + str(e), file=sys.stderr)
    sys.exit(1)
" 2>&1)

if [[ "$ADMIN_TOKEN" == ERROR:* ]]; then
  echo ""
  echo "ERROR: Could not get admin token."
  echo "  $ADMIN_TOKEN"
  echo ""
  echo "  Check: keycloakAdminUsername and keycloakAdminPassword in config.json"
  echo "  Response was: $TOKEN_RESPONSE"
  exit 1
fi
echo "   ✓ Admin token obtained"

AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"

# ── 2. Create realm ───────────────────────────────────────────────────────────
echo "[2/5] Creating realm '$KC_REALM'..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$KC_URL/admin/realms" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"realm\":\"$KC_REALM\",\"enabled\":true,\"registrationAllowed\":false,\"loginWithEmailAllowed\":true,\"duplicateEmailsAllowed\":false}")

if [ "$HTTP_STATUS" = "201" ]; then
  echo "   ✓ Realm '$KC_REALM' created"
elif [ "$HTTP_STATUS" = "409" ]; then
  echo "   ℹ Realm '$KC_REALM' already exists — skipping"
else
  echo "   WARNING: Realm creation returned HTTP $HTTP_STATUS"
fi

# ── 3. Create client ──────────────────────────────────────────────────────────
echo "[3/5] Creating client '$KC_CLIENT_ID'..."
CLIENT_PAYLOAD="{
  \"clientId\": \"$KC_CLIENT_ID\",
  \"name\": \"Analytics Dashboard\",
  \"enabled\": true,
  \"publicClient\": false,
  \"secret\": \"$KC_CLIENT_SECRET\",
  \"standardFlowEnabled\": true,
  \"directAccessGrantsEnabled\": true,
  \"serviceAccountsEnabled\": false,
  \"redirectUris\": [\"http://localhost:5173/*\",\"http://localhost:8000/*\",\"http://localhost:3000/*\",\"*\"],
  \"webOrigins\": [\"+\"]
}"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$KC_URL/admin/realms/$KC_REALM/clients" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "$CLIENT_PAYLOAD")

if [ "$HTTP_STATUS" = "201" ]; then
  echo "   ✓ Client '$KC_CLIENT_ID' created"
elif [ "$HTTP_STATUS" = "409" ]; then
  echo "   ℹ Client '$KC_CLIENT_ID' already exists — skipping"
else
  echo "   WARNING: Client creation returned HTTP $HTTP_STATUS"
fi

# ── 4. Create realm roles ─────────────────────────────────────────────────────
echo "[4/5] Creating roles: client, agent, admin, super_admin..."
for ROLE in client agent admin super_admin; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$KC_URL/admin/realms/$KC_REALM/roles" \
    -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -d "{\"name\":\"$ROLE\",\"description\":\"Analytics Dashboard $ROLE role\"}")
  if [ "$HTTP_STATUS" = "201" ]; then
    echo "   ✓ Role '$ROLE' created"
  elif [ "$HTTP_STATUS" = "409" ]; then
    echo "   ℹ Role '$ROLE' already exists — skipping"
  fi
done

# ── 5. Print client secret ────────────────────────────────────────────────────
echo "[5/5] Fetching client secret..."
CLIENT_LIST=$(curl -sf "$KC_URL/admin/realms/$KC_REALM/clients?clientId=$KC_CLIENT_ID" \
  -H "$AUTH_HEADER")

CLIENT_UUID=$(echo "$CLIENT_LIST" | python3 -c "
import sys, json
clients = json.load(sys.stdin)
print(clients[0]['id'] if clients else '')
" 2>/dev/null || echo "")

if [ -n "$CLIENT_UUID" ]; then
  SECRET_RESPONSE=$(curl -sf "$KC_URL/admin/realms/$KC_REALM/clients/$CLIENT_UUID/client-secret" \
    -H "$AUTH_HEADER")
  SECRET=$(echo "$SECRET_RESPONSE" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('value',''))
" 2>/dev/null || echo "")

  echo ""
  echo "════════════════════════════════════════════"
  echo "  ✅ Setup complete!"
  echo ""
  echo "  Keycloak URL   : $KC_URL"
  echo "  Realm          : $KC_REALM"
  echo "  Client ID      : $KC_CLIENT_ID"
  echo "  Client Secret  : ${SECRET:-$KC_CLIENT_SECRET}"
  echo ""
  echo "  Update config.json → oauthAppClientSecret: \"${SECRET:-$KC_CLIENT_SECRET}\""
  echo "  Update .env       → KEYCLOAK_CLIENT_SECRET=${SECRET:-$KC_CLIENT_SECRET}"
  echo "════════════════════════════════════════════"
else
  echo "   Setup complete! (could not fetch client UUID to retrieve secret)"
fi
