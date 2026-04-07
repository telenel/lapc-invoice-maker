#!/usr/bin/env bash
set -euo pipefail

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

PROJECT_DIR="/opt/lapc-invoice-maker"
DEFAULT_BRANCH="main"
TARGET_REF="${1:-${DEPLOY_REF:-$DEFAULT_BRANCH}}"
EXPECTED_SHA="${DEPLOY_EXPECTED_SHA:-}"
APP_URL="https://laportal.montalvo.io/api/version"
VERIFY_ATTEMPTS=36
VERIFY_SLEEP=10
VERIFY_INITIAL_SLEEP=15
BUILD_META_FILE=".build-meta.json"

runtime_build_meta_json() {
  local sha="$1"
  local time="$2"
  local supabase_url_configured=false
  local supabase_anon_key_configured=false

  if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
    supabase_url_configured=true
  fi

  if [ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
    supabase_anon_key_configured=true
  fi

  printf '{"buildSha":"%s","buildTime":"%s","publicEnv":{"supabaseUrlConfigured":%s,"supabaseAnonKeyConfigured":%s}}\n' \
    "$sha" \
    "$time" \
    "$supabase_url_configured" \
    "$supabase_anon_key_configured"
}

sync_runtime_build_meta() {
  local sha="$1"
  local time="$2"
  local payload
  local attempt

  payload=$(runtime_build_meta_json "$sha" "$time")

  for attempt in $(seq 1 15); do
    if printf '%s\n' "$payload" | docker compose exec -T app sh -lc "cat > /app/$BUILD_META_FILE"; then
      echo "[deploy] Synced runtime build metadata for $sha"
      return 0
    fi
    sleep 2
  done

  echo "[deploy] ERROR: failed to sync runtime build metadata for $sha"
  return 1
}

cd "$PROJECT_DIR"

set -a
source ./.env
set +a

if [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ] || [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
  echo "[deploy] ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set before building"
  exit 1
fi

PREV_COMMIT=$(git rev-parse HEAD)
echo "[deploy] Previous commit: $PREV_COMMIT"
echo "[deploy] Target ref: $TARGET_REF"
if [ -n "$EXPECTED_SHA" ]; then
  echo "[deploy] Expected commit: $EXPECTED_SHA"
fi

ROLLBACK_COMMIT="$PREV_COMMIT"
if [ -f .last-good-commit ]; then
  LAST_GOOD_COMMIT=$(cat .last-good-commit)
  if [ -n "$LAST_GOOD_COMMIT" ]; then
    ROLLBACK_COMMIT="$LAST_GOOD_COMMIT"
  fi
fi

rollback_deploy() {
  local target_commit="$1"
  echo "[deploy] Rolling back to $target_commit"
  git reset --hard "$target_commit"
  local rollback_sha
  local rollback_time
  rollback_sha=$(git rev-parse --short HEAD)
  rollback_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  docker compose build \
    --build-arg BUILD_SHA="$rollback_sha" \
    --build-arg BUILD_TIME="$rollback_time" \
    --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    app
  docker compose up -d --remove-orphans
  sync_runtime_build_meta "$rollback_sha" "$rollback_time"
}

echo "[deploy] Fetching latest code for $TARGET_REF..."
if ! git fetch origin "$TARGET_REF"; then
  echo "[deploy] ERROR: failed to fetch ref '$TARGET_REF' from origin"
  exit 1
fi

TARGET_COMMIT=$(git rev-parse FETCH_HEAD)
echo "[deploy] Resolved target commit: $TARGET_COMMIT"

if [ -n "$EXPECTED_SHA" ] && [ "$TARGET_COMMIT" != "$EXPECTED_SHA" ]; then
  echo "[deploy] ERROR: fetched ref '$TARGET_REF' resolved to $TARGET_COMMIT, expected $EXPECTED_SHA"
  exit 1
fi

echo "[deploy] Resetting worktree to $TARGET_COMMIT..."
git reset --hard "$TARGET_COMMIT"

NEW_COMMIT=$(git rev-parse HEAD)
BUILD_SHA=$(git rev-parse --short HEAD)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "[deploy] New commit: $NEW_COMMIT"

if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  echo "[deploy] No changes detected, skipping deploy"
  exit 0
fi

if ! docker compose build \
  --build-arg BUILD_SHA="$BUILD_SHA" \
  --build-arg BUILD_TIME="$BUILD_TIME" \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  app; then
  echo "[deploy] ERROR: Docker build failed — rolling repo checkout back to $PREV_COMMIT"
  git reset --hard "$PREV_COMMIT"
  exit 1
fi

echo "[deploy] Replacing containers with new image..."
if ! docker compose up -d --remove-orphans; then
  echo "[deploy] ERROR: docker compose up failed"
  rollback_deploy "$ROLLBACK_COMMIT" || true
  exit 1
fi

if ! sync_runtime_build_meta "$BUILD_SHA" "$BUILD_TIME"; then
  rollback_deploy "$ROLLBACK_COMMIT" || true
  exit 1
fi

echo "[deploy] Verifying deployed build SHA..."
sleep "$VERIFY_INITIAL_SLEEP"
last_body=""
for i in $(seq 1 "$VERIFY_ATTEMPTS"); do
  body=""
  if ! body=$(curl -fsS --connect-timeout 10 --max-time 20 "$APP_URL" 2>/dev/null); then
    body=""
  fi
  last_body="$body"
  deployed_sha=$(printf '%s' "$body" | grep -oE '"buildSha":"[^"]*"' | cut -d'"' -f4 || true)
  status=$(printf '%s' "$body" | grep -oE '"status":"[^"]+"' | cut -d'"' -f4 || true)
  echo "[deploy] Attempt $i/$VERIFY_ATTEMPTS: status=${status:-unknown} buildSha=${deployed_sha:-missing}"
  if [ "$status" = "ok" ] && [ "$deployed_sha" = "$BUILD_SHA" ]; then
    echo "$NEW_COMMIT" > .last-good-commit
    echo "[deploy] Deploy complete — app is serving $BUILD_SHA"
    exit 0
  fi
  sleep "$VERIFY_SLEEP"
done

echo "[deploy] Last /api/version response: ${last_body:-<empty>}"
echo "[deploy] ERROR: live site never reported build SHA $BUILD_SHA"
rollback_deploy "$ROLLBACK_COMMIT" || true
docker compose ps
docker compose logs app --tail 80 || true
exit 1
