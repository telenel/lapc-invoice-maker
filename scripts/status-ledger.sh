#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

echo "==> Current branch"
git status --short --branch

echo ""
echo "==> Local-only commits by branch"
found_local_only=0
while IFS= read -r branch; do
  [ -n "$branch" ] || continue

  count=$(git rev-list --count "$branch" --not --remotes 2>/dev/null || printf '0')
  case "$count" in
    ''|*[!0-9]*) count=0 ;;
  esac

  if [ "$count" -gt 0 ]; then
    found_local_only=1
    echo ""
    echo "$branch ($count local-only commit(s))"
    git log --oneline "$branch" --not --remotes --max-count=10 | sed 's/^/  /'
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads)

if [ "$found_local_only" -eq 0 ]; then
  echo "none"
fi

echo ""
echo "==> Open PRs"
if command -v gh >/dev/null 2>&1; then
  prs=$(gh pr list --state open --json number,isDraft,headRefName,title,url \
    --jq '.[] | "#\(.number) " + (if .isDraft then "[draft] " else "[ready] " end) + .headRefName + " - " + .title + " " + .url' \
    2>/dev/null || true)
  if [ -n "$prs" ]; then
    printf '%s\n' "$prs"
  else
    echo "none"
  fi
else
  echo "gh CLI not available"
fi

echo ""
echo "==> Stashes"
git stash list --date=local | sed -n '1,20p'
