#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
git_dir=$(git rev-parse --git-dir)
stamp_dir="$git_dir/laportal"
ship_check_file="$stamp_dir/ship-check.env"

cd "$repo_root"

if ! command -v gh >/dev/null 2>&1; then
  echo "BLOCKED: gh CLI is required to checkpoint branch work."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "BLOCKED: git:checkpoint requires a clean working tree."
  echo "Commit or stash changes first."
  echo ""
  git status --short --branch
  exit 1
fi

branch=$(git symbolic-ref --short HEAD 2>/dev/null || true)
if [ -z "$branch" ] || [ "$branch" = "main" ]; then
  echo "BLOCKED: git:checkpoint must run from a non-main branch."
  exit 1
fi

echo "==> git fetch origin --prune"
git fetch origin --prune

if [ "$(git rev-list --count origin/main..HEAD)" -eq 0 ]; then
  echo "BLOCKED: branch '$branch' has no commits ahead of origin/main."
  echo "Make a focused commit first, then run: npm run git:checkpoint"
  exit 1
fi

head_sha=$(git rev-parse HEAD)

if [ ! -f "$ship_check_file" ]; then
  echo "BLOCKED: missing ship-check stamp. Run: npm run ship-check"
  exit 1
fi

# shellcheck disable=SC1090
. "$ship_check_file"
if [ "${SHIP_CHECK_HEAD:-}" != "$head_sha" ]; then
  echo "BLOCKED: ship-check stamp does not match HEAD $head_sha"
  echo "Run: npm run ship-check"
  exit 1
fi

pr_count=$(gh pr list --head "$branch" --state open --json number --jq 'length' 2>/dev/null || printf '0')
[ -n "$pr_count" ] || pr_count=0
case "$pr_count" in
  ''|*[!0-9]*) pr_count=0 ;;
esac

if [ "$pr_count" -gt 1 ]; then
  echo "BLOCKED: branch '$branch' has more than one open PR."
  gh pr list --head "$branch" --state open --json number,title,url --jq '.[] | "#\(.number) \(.title) \(.url)"'
  exit 1
fi

if [ "$pr_count" -eq 1 ]; then
  pr_number=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
  pr_is_draft=$(gh pr list --head "$branch" --state open --json isDraft --jq '.[0].isDraft')

  if [ "$pr_is_draft" != "true" ]; then
    echo "BLOCKED: branch '$branch' already has ready PR #$pr_number."
    echo "Ready PRs only accept explicit review-fix pushes:"
    echo "  CR_FIX=1 git push"
    exit 1
  fi

  echo "==> git push -u origin $branch"
  git push -u origin "$branch"

  echo ""
  echo "Draft PR #$pr_number updated."
  gh pr view "$pr_number" --json url --jq '.url'
  exit 0
fi

echo "==> git push -u origin $branch"
git push -u origin "$branch"

echo ""
echo "==> gh pr create --draft --fill --base main --head $branch"
gh pr create --draft --fill --base main --head "$branch"
