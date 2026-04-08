#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${DEPLOY_SMOKE_BASE_URL:-https://laportal.montalvo.io}"
CONNECT_TIMEOUT="${DEPLOY_SMOKE_CONNECT_TIMEOUT:-10}"
MAX_TIME="${DEPLOY_SMOKE_MAX_TIME:-20}"
CHECKS="${DEPLOY_SMOKE_CHECKS:-/login|LAPortal|login page;/textbook-requisitions/submit|Textbook Requisition|textbook requisition form}"

if [ -z "$CHECKS" ]; then
  echo "[smoke] No smoke checks configured"
  exit 0
fi

old_ifs="$IFS"
IFS=';'
for raw_check in $CHECKS; do
  IFS="$old_ifs"

  check=$(printf '%s' "$raw_check" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  if [ -z "$check" ]; then
    IFS=';'
    continue
  fi

  path=""
  expected=""
  label=""
  IFS='|' read -r path expected label <<EOF
$check
EOF

  IFS="$old_ifs"

  path=$(printf '%s' "$path" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  expected=$(printf '%s' "$expected" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  label=$(printf '%s' "$label" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')

  if [ -z "$path" ]; then
    echo "[smoke] ERROR: invalid smoke check entry '$check'"
    exit 1
  fi

  url="$path"
  case "$url" in
    http://*|https://*)
      ;;
    /*)
      url="${BASE_URL%/}$url"
      ;;
    *)
      url="${BASE_URL%/}/$url"
      ;;
  esac

  if [ -z "$label" ]; then
    label="$url"
  fi

  echo "[smoke] Checking $label -> $url"
  body=$(curl -fsS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" "$url")

  if [ -n "$expected" ] && ! printf '%s' "$body" | grep -Fq "$expected"; then
    echo "[smoke] ERROR: expected '$expected' in $url"
    exit 1
  fi
done
IFS="$old_ifs"

echo "[smoke] All smoke checks passed"
