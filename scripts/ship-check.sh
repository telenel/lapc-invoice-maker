#!/bin/bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
git_dir=$(git rev-parse --git-dir)
stamp_dir="$git_dir/laportal"
stamp_file="$stamp_dir/ship-check.env"
codex_review_file="$stamp_dir/codex-review.env"

cd "$repo_root"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "BLOCKED: ship-check requires a clean working tree."
  echo "Commit or stash changes first so lint, tests, and build run against the exact HEAD you plan to push."
  echo ""
  git status --short --branch
  exit 1
fi

head_sha=$(git rev-parse HEAD)
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "==> Validating HEAD $head_sha"
if [ -f "$codex_review_file" ]; then
  # shellcheck disable=SC1090
  . "$codex_review_file"

  if [ "${CODEX_REVIEW_HEAD:-}" = "$head_sha" ]; then
    echo "==> Codex review stamp: fresh ${CODEX_REVIEW_RESULT:-UNKNOWN} (${CODEX_REVIEW_CREATED_AT:-unknown})"
  else
    echo "==> Codex review stamp: stale ${CODEX_REVIEW_RESULT:-UNKNOWN} for ${CODEX_REVIEW_HEAD:-unknown} (${CODEX_REVIEW_CREATED_AT:-unknown})"
  fi
else
  echo "==> Codex review stamp: none"
fi

echo "==> git status"
git status --short --branch

echo ""
echo "==> npm run lint"
npm run lint

echo ""
echo "==> npm test"
npm test

echo ""
echo "==> npm run build"
npm run build

mkdir -p "$stamp_dir"
{
  printf 'SHIP_CHECK_HEAD=%q\n' "$head_sha"
  printf 'SHIP_CHECK_CREATED_AT=%q\n' "$timestamp"
} > "$stamp_file"

echo ""
echo "Recorded ship-check stamp for HEAD $head_sha"
echo "Stamp file: $stamp_file"
