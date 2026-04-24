#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/safe-switch.sh <branch>

Examples:
  ./scripts/safe-switch.sh main
  ./scripts/safe-switch.sh feat/invoice-export-cleanup

This is the safe replacement for raw `git switch` when leaving a branch.
It blocks if the current branch has commits that are not on any remote.
EOF
}

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

target="$1"
current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || true)

if [ -n "$(git status --porcelain=v1 --untracked-files=all)" ]; then
  echo "BLOCKED: working tree has uncommitted changes."
  echo "Commit, stash with a clear name, or discard intentionally before switching."
  echo ""
  git status --short --branch
  exit 1
fi

echo "==> git fetch origin --prune"
git fetch origin --prune

if [ -n "$current_branch" ] && [ "$current_branch" != "main" ]; then
  local_only_count=$(git rev-list --count "$current_branch" --not --remotes 2>/dev/null || printf '0')
  case "$local_only_count" in
    ''|*[!0-9]*) local_only_count=0 ;;
  esac

  if [ "$local_only_count" -gt 0 ] && [ "${LAPORTAL_ALLOW_LOCAL_ONLY_SWITCH:-0}" != "1" ]; then
    echo "BLOCKED: branch '$current_branch' has $local_only_count local-only commit(s)."
    echo ""
    git log --oneline "$current_branch" --not --remotes --max-count=10
    echo ""
    echo "Make the work visible before switching:"
    echo "  npm run ship-check"
    echo "  npm run git:checkpoint"
    echo ""
    echo "If this branch is intentionally abandoned, delete or archive it explicitly."
    echo "For a one-time emergency override:"
    echo "  LAPORTAL_ALLOW_LOCAL_ONLY_SWITCH=1 npm run git:switch -- $target"
    exit 1
  fi

  if [ "$local_only_count" -gt 0 ]; then
    echo "WARNING: overriding local-only commit guard for '$current_branch'."
  fi
fi

echo ""
echo "==> git switch $target"
git switch "$target"

if [ "$target" = "main" ]; then
  echo ""
  echo "==> git pull --ff-only origin main"
  git pull --ff-only origin main
fi
