#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/resume-branch.sh [--discard-local] <branch-name>

Examples:
  ./scripts/resume-branch.sh feat/invoice-export-cleanup
  ./scripts/resume-branch.sh --discard-local feat/invoice-export-cleanup

Safe default:
  - fetches origin
  - switches to the branch
  - fast-forwards or hard-resets only when local branch is behind origin
  - blocks if this machine has local-only commits or diverged history

Use --discard-local only when GitHub is the source of truth and you want to
replace this machine's copy of the branch with origin/<branch-name>.
EOF
}

discard_local=0
if [ "${1:-}" = "--discard-local" ]; then
  discard_local=1
  shift
fi

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

branch="$1"

if [ -n "$(git status --porcelain=v1 --untracked-files=all)" ]; then
  echo "BLOCKED: resume-branch requires a clean working tree."
  echo "Commit, stash, or clean local changes first."
  echo ""
  git status --short --branch
  exit 1
fi

echo "==> git fetch origin --prune"
git fetch origin --prune

if ! git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  echo "BLOCKED: remote branch 'origin/$branch' does not exist."
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch"; then
  echo ""
  echo "==> git switch $branch"
  git switch "$branch"
else
  echo ""
  echo "==> git switch -c $branch --track origin/$branch"
  git switch -c "$branch" --track "origin/$branch"
fi

git branch --set-upstream-to "origin/$branch" "$branch" >/dev/null 2>&1 || true

local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$branch")

if [ "$local_sha" = "$remote_sha" ]; then
  echo ""
  echo "Branch already matches origin/$branch at $remote_sha"
  exit 0
fi

if git merge-base --is-ancestor "$local_sha" "$remote_sha"; then
  echo ""
  echo "==> git reset --hard origin/$branch"
  git reset --hard "origin/$branch"
  echo ""
  echo "Branch synced to origin/$branch at $remote_sha"
  exit 0
fi

if [ "$discard_local" -eq 1 ]; then
  echo ""
  echo "==> git reset --hard origin/$branch"
  git reset --hard "origin/$branch"
  echo ""
  echo "Local branch discarded and replaced with origin/$branch at $remote_sha"
  exit 0
fi

echo ""
echo "BLOCKED: local branch '$branch' has commits that are not on origin/$branch."
echo "Local:  $local_sha"
echo "Remote: $remote_sha"
echo ""
echo "Push or inspect those commits before switching machines,"
echo "or rerun with: npm run git:resume-branch -- --discard-local $branch"
exit 1
