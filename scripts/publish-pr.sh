#!/bin/bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
git_dir=$(git rev-parse --git-dir)
stamp_dir="$git_dir/laportal"
ship_check_file="$stamp_dir/ship-check.env"
codex_review_file="$stamp_dir/codex-review.env"

cd "$repo_root"

if ! command -v gh >/dev/null 2>&1; then
  echo "BLOCKED: gh CLI is required to publish a PR."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "BLOCKED: publish-pr requires a clean working tree."
  echo "Commit or stash changes first."
  echo ""
  git status --short --branch
  exit 1
fi

branch=$(git symbolic-ref --short HEAD 2>/dev/null || true)
if [ -z "$branch" ] || [ "$branch" = "main" ]; then
  echo "BLOCKED: publish-pr must run from a non-main branch."
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

if [ ! -f "$codex_review_file" ]; then
  echo "BLOCKED: missing Codex review stamp. Run: npm run review:codex"
  exit 1
fi

# shellcheck disable=SC1090
. "$codex_review_file"
if [ "${CODEX_REVIEW_HEAD:-}" != "$head_sha" ]; then
  echo "BLOCKED: Codex review stamp does not match HEAD $head_sha"
  echo "Run: npm run review:codex"
  exit 1
fi

if [ "${CODEX_REVIEW_RESULT:-}" != "PASS" ]; then
  echo "BLOCKED: Codex review must return PASS before opening a PR."
  echo "Run: npm run review:codex"
  exit 1
fi

pr_count=$(gh pr list --head "$branch" --state open --json number --jq 'length' 2>/dev/null || printf '0')
[ -n "$pr_count" ] || pr_count=0
case "$pr_count" in
  ''|*[!0-9]*) pr_count=0 ;;
esac

if [ "$pr_count" -gt 0 ]; then
  echo "BLOCKED: branch '$branch' already has an open PR."
  echo "Use CR_FIX=1 git push for follow-up review fixes."
  exit 1
fi

echo "==> git push -u origin $branch"
git push -u origin "$branch"

echo ""
echo "==> gh pr create --fill --base main --head $branch"
gh pr create --fill --base main --head "$branch"

echo ""
echo "==> gh pr merge --auto --squash --delete-branch"
gh pr merge --auto --squash --delete-branch
