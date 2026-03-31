#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/lapc-invoice-maker"
DEFAULT_BRANCH="main"
APP_URL="https://laportal.montalvo.io/api/version"
VERIFY_ATTEMPTS=12
VERIFY_SLEEP=10

cd "$PROJECT_DIR"

PREV_COMMIT=$(git rev-parse HEAD)
echo "[deploy] Previous commit: $PREV_COMMIT"

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
  rollback_sha=$(git rev-parse --short HEAD)
  docker compose build --build-arg BUILD_SHA="$rollback_sha" app
  docker compose up -d --remove-orphans
}

echo "[deploy] Fetching latest code..."
git fetch origin "$DEFAULT_BRANCH"

echo "[deploy] Resetting to origin/$DEFAULT_BRANCH..."
git reset --hard "origin/$DEFAULT_BRANCH"

NEW_COMMIT=$(git rev-parse HEAD)
BUILD_SHA=$(git rev-parse --short HEAD)
echo "[deploy] New commit: $NEW_COMMIT"

if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  echo "[deploy] No changes detected, skipping deploy"
  exit 0
fi

if ! docker compose build --build-arg BUILD_SHA="$BUILD_SHA" app; then
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

echo "[deploy] Verifying deployed build SHA..."
for i in $(seq 1 "$VERIFY_ATTEMPTS"); do
  body=$(curl -fsS --connect-timeout 10 --max-time 20 "$APP_URL" || true)
  deployed_sha=$(printf '%s' "$body" | grep -oE '"buildSha":"[a-f0-9]+"' | cut -d'"' -f4 || true)
  status=$(printf '%s' "$body" | grep -oE '"status":"[^"]+"' | cut -d'"' -f4 || true)
  echo "[deploy] Attempt $i/$VERIFY_ATTEMPTS: status=${status:-unknown} buildSha=${deployed_sha:-missing}"
  if [ "$status" = "ok" ] && [ "$deployed_sha" = "$BUILD_SHA" ]; then
    echo "$NEW_COMMIT" > .last-good-commit
    echo "[deploy] Deploy complete — app is serving $BUILD_SHA"
    exit 0
  fi
  sleep "$VERIFY_SLEEP"
done

echo "[deploy] ERROR: live site never reported build SHA $BUILD_SHA"
rollback_deploy "$ROLLBACK_COMMIT" || true
docker compose ps
docker compose logs app --tail 80 || true
exit 1
