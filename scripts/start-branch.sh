#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/start-branch.sh <branch-name>

Examples:
  ./scripts/start-branch.sh feat/invoice-export-cleanup
  ./scripts/start-branch.sh hotfix/quote-approval-timeout
EOF
}

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

branch="$1"

if [ -n "$(git status --porcelain=v1 --untracked-files=all)" ]; then
  echo "BLOCKED: start-branch requires a clean working tree."
  echo "Commit, stash, or clean local changes first."
  echo ""
  git status --short --branch
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch"; then
  echo "BLOCKED: local branch '$branch' already exists."
  echo "Use: npm run git:resume-branch -- $branch"
  exit 1
fi

if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  echo "BLOCKED: remote branch 'origin/$branch' already exists."
  echo "Use: npm run git:resume-branch -- $branch"
  exit 1
fi

echo "==> git fetch origin --prune"
git fetch origin --prune

echo ""
echo "==> git switch main"
git switch main

echo ""
echo "==> git pull --ff-only origin main"
git pull --ff-only origin main

echo ""
echo "==> git switch -c $branch"
git switch -c "$branch"

echo ""
echo "Branch ready: $branch"
echo "Next: make one focused change, run npm run ship-check, then npm run git:publish-pr"
