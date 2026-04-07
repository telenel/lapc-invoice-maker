#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

head_sha=$(git rev-parse HEAD)

echo "==> Hotfix preflight for HEAD $head_sha"
echo "==> git status"
git status --short --branch

echo ""
echo "==> npm run lint"
npm run lint

if [ "$#" -gt 0 ]; then
  echo ""
  echo "==> $*"
  "$@"
elif [ -n "${HOTFIX_TEST_COMMAND:-}" ]; then
  echo ""
  echo "==> $HOTFIX_TEST_COMMAND"
  bash -lc "$HOTFIX_TEST_COMMAND"
else
  echo ""
  echo "==> Skipping tests (set HOTFIX_TEST_COMMAND or pass a command to hotfix-preflight)"
fi

echo ""
echo "==> npm run build"
npm run build

echo ""
echo "Hotfix preflight passed for HEAD $head_sha"
