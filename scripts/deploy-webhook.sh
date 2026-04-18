#!/usr/bin/env bash
set -euo pipefail

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

PROJECT_DIR="/opt/lapc-invoice-maker"
DEFAULT_BRANCH="main"
TARGET_REF="${1:-${DEPLOY_REF:-$DEFAULT_BRANCH}}"
EXPECTED_SHA="${DEPLOY_EXPECTED_SHA:-}"
DEPLOY_CHANNEL="${DEPLOY_CHANNEL:-direct}"
DEPLOY_ACTOR="${DEPLOY_ACTOR:-$(whoami 2>/dev/null || echo unknown)}"
APP_URL="https://laportal.montalvo.io/api/version"
SMOKE_BASE_URL="${DEPLOY_SMOKE_BASE_URL:-https://laportal.montalvo.io}"
VERIFY_ATTEMPTS=36
VERIFY_SLEEP=10
VERIFY_INITIAL_SLEEP=15
DEPLOY_LOG_FILE=".deploy-history.log"
DEPLOY_IMAGE="${DEPLOY_IMAGE:-}"

infer_image_repository() {
  local origin_url owner_repo

  origin_url=$(git config --get remote.origin.url || true)
  owner_repo=""

  case "$origin_url" in
    git@github.com:*)
      owner_repo="${origin_url#git@github.com:}"
      ;;
    https://github.com/*)
      owner_repo="${origin_url#https://github.com/}"
      ;;
    http://github.com/*)
      owner_repo="${origin_url#http://github.com/}"
      ;;
  esac

  owner_repo="${owner_repo%.git}"
  if [ -z "$owner_repo" ]; then
    return 0
  fi

  printf 'ghcr.io/%s\n' "$(printf '%s' "$owner_repo" | tr '[:upper:]' '[:lower:]')"
}

extract_json_string_field() {
  local body="$1"
  local field="$2"

  printf '%s' "$body" | grep -oE "\"$field\":\"[^\"]*\"" | cut -d'"' -f4 || true
}

fetch_live_version() {
  curl -fsS --connect-timeout 10 --max-time 20 "$APP_URL" 2>/dev/null || true
}

append_deploy_log() {
  local outcome="$1"
  local message="$2"
  local timestamp

  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  printf '%s\toutcome=%s\tchannel=%s\tactor=%s\tref=%s\texpected=%s\tcommit=%s\tbuild_sha=%s\tmessage=%s\n' \
    "$timestamp" \
    "$outcome" \
    "$DEPLOY_CHANNEL" \
    "$DEPLOY_ACTOR" \
    "$TARGET_REF" \
    "${EXPECTED_SHA:-none}" \
    "${NEW_COMMIT:-unknown}" \
    "${BUILD_SHA:-unknown}" \
    "$message" >> "$DEPLOY_LOG_FILE"
}

run_smoke_checks() {
  if [ ! -x ./scripts/deploy-smoke-check.sh ]; then
    echo "[deploy] No executable smoke check script found — skipping smoke checks"
    return 0
  fi

  DEPLOY_SMOKE_BASE_URL="$SMOKE_BASE_URL" ./scripts/deploy-smoke-check.sh
}

login_registry_if_configured() {
  if [ -z "${GHCR_USERNAME:-}" ] || [ -z "${GHCR_TOKEN:-}" ]; then
    return 0
  fi

  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null
}

deploy_with_image() {
  local image="$1"
  local build_sha="$2"
  local build_time="$3"

  login_registry_if_configured

  echo "[deploy] Pulling image $image..."
  docker pull "$image"

  echo "[deploy] Replacing containers with pulled image..."
  APP_IMAGE="$image" BUILD_SHA="$build_sha" BUILD_TIME="$build_time" \
    docker compose up -d --remove-orphans --no-build
}

deploy_with_build() {
  local build_sha="$1"
  local build_time="$2"

  echo "[deploy] Building app image locally..."
  BUILD_SHA="$build_sha" BUILD_TIME="$build_time" docker compose build app

  echo "[deploy] Replacing containers with newly built image..."
  BUILD_SHA="$build_sha" BUILD_TIME="$build_time" docker compose up -d --remove-orphans
}

cd "$PROJECT_DIR"

set -a
source ./.env
set +a

DEPLOY_IMAGE_REPOSITORY="${DEPLOY_IMAGE_REPOSITORY:-$(infer_image_repository)}"
DEPLOY_MODE="build"
if [ -n "$DEPLOY_IMAGE" ]; then
  DEPLOY_MODE="image"
fi

if [ "$DEPLOY_MODE" = "build" ] && { [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ] || [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; }; then
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
  local rollback_image=""

  echo "[deploy] Rolling back to $target_commit"
  git reset --hard "$target_commit"
  BUILD_SHA=$(git rev-parse --short=7 HEAD)
  BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  if [ "$DEPLOY_MODE" = "image" ]; then
    if [ -z "$DEPLOY_IMAGE_REPOSITORY" ]; then
      echo "[deploy] ERROR: cannot infer GHCR image repository for rollback"
      append_deploy_log "rollback_failed" "missing image repository for rollback"
      return 1
    fi

    rollback_image="${DEPLOY_IMAGE_REPOSITORY}:$target_commit"
    if ! deploy_with_image "$rollback_image" "$BUILD_SHA" "$BUILD_TIME"; then
      append_deploy_log "rollback_failed" "failed to pull rollback image ${rollback_image}"
      return 1
    fi
  else
    if ! deploy_with_build "$BUILD_SHA" "$BUILD_TIME"; then
      append_deploy_log "rollback_failed" "local rebuild failed during rollback"
      return 1
    fi
  fi

  append_deploy_log "rollback" "rollback to ${target_commit}"
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
  append_deploy_log "sha_mismatch" "fetched $TARGET_COMMIT but expected $EXPECTED_SHA"
  exit 1
fi

echo "[deploy] Resetting worktree to $TARGET_COMMIT..."
git reset --hard "$TARGET_COMMIT"

NEW_COMMIT=$(git rev-parse HEAD)
BUILD_SHA=$(git rev-parse --short=7 HEAD)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "[deploy] New commit: $NEW_COMMIT"
if [ "$DEPLOY_MODE" = "image" ]; then
  echo "[deploy] Target image: $DEPLOY_IMAGE"
fi

live_before_body=$(fetch_live_version)
live_before_sha=$(extract_json_string_field "$live_before_body" "buildSha")
live_before_status=$(extract_json_string_field "$live_before_body" "status")
if [ -n "$live_before_sha" ]; then
  echo "[deploy] Live build before deploy: $live_before_sha (status=${live_before_status:-unknown})"
fi

if [ "$live_before_status" = "ok" ] && [ "$live_before_sha" = "$BUILD_SHA" ]; then
  echo "[deploy] Live app already reports $BUILD_SHA — running smoke checks before skipping deploy"
  if run_smoke_checks; then
    echo "$NEW_COMMIT" > .last-good-commit
    append_deploy_log "skip" "live app already serving $BUILD_SHA and smoke checks passed"
    echo "[deploy] Live app already serves $BUILD_SHA — skipping deploy"
    exit 0
  fi
  echo "[deploy] Smoke checks failed while target SHA was already live — re-deploying target SHA to recover"
fi

if [ "$DEPLOY_MODE" = "image" ]; then
  if ! deploy_with_image "$DEPLOY_IMAGE" "$BUILD_SHA" "$BUILD_TIME"; then
    echo "[deploy] ERROR: image pull or container replace failed"
    append_deploy_log "pull_failed" "failed to pull or start $DEPLOY_IMAGE"
    rollback_deploy "$ROLLBACK_COMMIT" || true
    exit 1
  fi
elif ! deploy_with_build "$BUILD_SHA" "$BUILD_TIME"; then
  echo "[deploy] ERROR: local image build or container replace failed"
  git reset --hard "$PREV_COMMIT"
  append_deploy_log "build_failed" "docker compose build/up failed"
  rollback_deploy "$ROLLBACK_COMMIT" || true
  exit 1
fi

echo "[deploy] Verifying deployed build SHA..."
sleep "$VERIFY_INITIAL_SLEEP"
last_body=""
for i in $(seq 1 "$VERIFY_ATTEMPTS"); do
  body=$(fetch_live_version)
  last_body="$body"
  deployed_sha=$(extract_json_string_field "$body" "buildSha")
  status=$(extract_json_string_field "$body" "status")
  echo "[deploy] Attempt $i/$VERIFY_ATTEMPTS: status=${status:-unknown} buildSha=${deployed_sha:-missing}"
  if [ "$status" = "ok" ] && [ "$deployed_sha" = "$BUILD_SHA" ]; then
    echo "[deploy] Running smoke checks..."
    if ! run_smoke_checks; then
      echo "[deploy] ERROR: smoke checks failed after deploy"
      append_deploy_log "smoke_failed" "route smoke checks failed for $BUILD_SHA"
      rollback_deploy "$ROLLBACK_COMMIT" || true
      docker compose ps
      docker compose logs app --tail 80 || true
      exit 1
    fi
    echo "$NEW_COMMIT" > .last-good-commit
    append_deploy_log "success" "live app is serving $BUILD_SHA and smoke checks passed"
    echo "[deploy] Deploy complete — app is serving $BUILD_SHA"
    exit 0
  fi
  sleep "$VERIFY_SLEEP"
done

echo "[deploy] Last /api/version response: ${last_body:-<empty>}"
echo "[deploy] ERROR: live site never reported build SHA $BUILD_SHA"
append_deploy_log "verify_failed" "live site never reported $BUILD_SHA"
rollback_deploy "$ROLLBACK_COMMIT" || true
docker compose ps
docker compose logs app --tail 80 || true
exit 1
