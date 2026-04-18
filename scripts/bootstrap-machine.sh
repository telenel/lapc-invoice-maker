#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/bootstrap-machine.sh
  ./scripts/bootstrap-machine.sh --repo-only

Default behavior:
  - sets LAPortal repo-local git safety defaults
  - sets the same defaults globally for this machine

Use --repo-only to skip the global git config writes.
EOF
}

scope="global"
if [ "${1:-}" = "--repo-only" ]; then
  scope="repo-only"
  shift
fi

if [ "$#" -gt 0 ]; then
  usage
  exit 1
fi

repo_configs=(
  "core.hooksPath hooks"
  "pull.ff only"
  "fetch.prune true"
  "rerere.enabled true"
  "merge.conflictStyle zdiff3"
  "push.autoSetupRemote true"
)

global_configs=(
  "pull.ff only"
  "fetch.prune true"
  "rerere.enabled true"
  "merge.conflictStyle zdiff3"
  "push.autoSetupRemote true"
)

echo "==> Applying LAPortal repo-local git defaults"
for entry in "${repo_configs[@]}"; do
  key=${entry%% *}
  value=${entry#* }
  git config --local "$key" "$value"
  echo "   git config --local $key $value"
done

if [ "$scope" = "global" ]; then
  echo ""
  echo "==> Applying machine-wide git defaults"
  for entry in "${global_configs[@]}"; do
    key=${entry%% *}
    value=${entry#* }
    git config --global "$key" "$value"
    echo "   git config --global $key $value"
  done
fi

echo ""
echo "Bootstrap complete."
echo "Start new work with: npm run git:start-branch -- feat/your-topic"
echo "Resume remote work with: npm run git:resume-branch -- feat/your-topic"
