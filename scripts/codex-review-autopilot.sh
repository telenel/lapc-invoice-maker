#!/bin/bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
git_dir=$(git rev-parse --git-dir)
live_review_log=$(mktemp "${TMPDIR:-/tmp}/codex-review-autopilot-review.XXXXXX.log")
orchestrator_log=$(mktemp "${TMPDIR:-/tmp}/codex-review-autopilot-orchestrator.XXXXXX.log")
orchestrator_prompt="$repo_root/.codex/prompts/live-autopilot.md"
review_pid=""

cd "$repo_root"

usage() {
  cat <<'EOF'
Usage: ./scripts/codex-review-autopilot.sh [review:codex:live options]

Starts the live Codex review producer and launches the orchestrator in one command.
Pass the same base-ref or focus options you would pass to `npm run review:codex:live`.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      usage
      exit 0
      ;;
  esac
done

if ! command -v codex >/dev/null 2>&1; then
  echo "BLOCKED: codex CLI is required for autopilot."
  exit 1
fi

mkdir -p "$git_dir/laportal"
rm -f "$live_review_log" "$orchestrator_log"

echo "==> Starting live Codex review producer"
node "$repo_root/scripts/codex-review-live.mjs" "$@" >"$live_review_log" 2>&1 &
review_pid=$!

cleanup() {
  if [ -n "${review_pid:-}" ] && kill -0 "$review_pid" >/dev/null 2>&1; then
    kill "$review_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> Starting Codex orchestrator"
codex exec \
  --full-auto \
  --cd "$repo_root" \
  --output-last-message "$orchestrator_log" \
  < "$orchestrator_prompt"

orchestrator_status=$?

if kill -0 "$review_pid" >/dev/null 2>&1; then
  wait "$review_pid" || true
fi

echo ""
echo "==> Autopilot summary"
if [ -f "$orchestrator_log" ]; then
  cat "$orchestrator_log"
fi

rm -f "$live_review_log" "$orchestrator_log"

exit "$orchestrator_status"
