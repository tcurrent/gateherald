#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SAMPLE_ROUTE_PATH="${SAMPLE_ROUTE_PATH:-/webhook/sample/01J0Z8X3GWBD9117Q9H4M2KCFP}"
UNKNOWN_ROUTE_PATH="${UNKNOWN_ROUTE_PATH:-/webhook/sample/not-configured}"
START_SERVER="${START_SERVER:-1}"
SEED_SAMPLE_DATA="${SEED_SAMPLE_DATA:-1}"
STARTUP_TIMEOUT_SEC="${STARTUP_TIMEOUT_SEC:-30}"

PASS_COUNT=0
FAIL_COUNT=0
SERVER_PID=""
SERVER_LOG_FILE="/tmp/gateherald-smoke-server.log"

pass() {
  echo "PASS: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "FAIL: $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "Running Gateherald smoke E2E against $BASE_URL"

if [ "$SEED_SAMPLE_DATA" = "1" ]; then
  echo "Seeding sample data..."
  npm run db:seed >/tmp/gateherald-smoke-seed.log 2>&1
fi

if [ "$START_SERVER" = "1" ]; then
  echo "Starting server..."
  npm start >"$SERVER_LOG_FILE" 2>&1 &
  SERVER_PID=$!

  started=0
  for _ in $(seq 1 "$STARTUP_TIMEOUT_SEC"); do
    if curl -sf "$BASE_URL/api" >/dev/null; then
      started=1
      break
    fi
    sleep 1
  done

  if [ "$started" -ne 1 ]; then
    echo "Server failed to become ready in ${STARTUP_TIMEOUT_SEC}s"
    if [ -f "$SERVER_LOG_FILE" ]; then
      echo "--- server log ---"
      cat "$SERVER_LOG_FILE"
      echo "--- end server log ---"
    fi
    exit 1
  fi
fi

check_http() {
  local label="$1"
  local expected_code="$2"
  local method="$3"
  local url="$4"
  local body="${5:-}"

  local output_file
  output_file="$(mktemp)"
  local code

  if [ -n "$body" ]; then
    code="$(curl -s -o "$output_file" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" --data-raw "$body")"
  else
    code="$(curl -s -o "$output_file" -w "%{http_code}" -X "$method" "$url")"
  fi

  if [ "$code" = "$expected_code" ]; then
    pass "$label (HTTP $code)"
  else
    echo "  URL: $url"
    echo "  Expected: $expected_code"
    echo "  Actual:   $code"
    echo "  Body:"
    sed 's/^/    /' "$output_file"
    fail "$label"
  fi

  LAST_OUTPUT_FILE="$output_file"
}

check_http "Health endpoint" "200" "GET" "$BASE_URL/api"
rm -f "$LAST_OUTPUT_FILE"

sample_payload='{"name":"CI Alert","timestamp":"2026-03-28T10:00:00Z","host":"ci-host","description":"smoke"}'
check_http "Webhook configured route" "200" "POST" "$BASE_URL$SAMPLE_ROUTE_PATH" "$sample_payload"
if grep -q "Picked up by Herald at the Gate" "$LAST_OUTPUT_FILE"; then
  pass "Configured route response body"
else
  echo "  Expected response to include: Picked up by Herald at the Gate"
  echo "  Actual body:"
  sed 's/^/    /' "$LAST_OUTPUT_FILE"
  fail "Configured route response body"
fi
rm -f "$LAST_OUTPUT_FILE"

check_http "Webhook unknown route" "404" "POST" "$BASE_URL$UNKNOWN_ROUTE_PATH" '{"x":1}'
if grep -Eq "Route not configured|Cannot POST" "$LAST_OUTPUT_FILE"; then
  pass "Unknown route response body"
else
  echo "  Expected 404 body to include route error text"
  echo "  Actual body:"
  sed 's/^/    /' "$LAST_OUTPUT_FILE"
  fail "Unknown route response body"
fi
rm -f "$LAST_OUTPUT_FILE"

echo
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

exit 0
