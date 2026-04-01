#!/bin/bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
git_dir=$(git rev-parse --git-dir)
review_script="$repo_root/scripts/codex-review-local.sh"
triage_script="$repo_root/scripts/codex-review-remediation.mjs"
artifact_path="$git_dir/laportal/codex-review.json"
json_mode=0

for arg in "$@"; do
  if [ "$arg" = "--json" ]; then
    json_mode=1
    break
  fi
done

cd "$repo_root"
"$review_script" "$@"

if [ "$json_mode" -eq 0 ] && [ -f "$artifact_path" ]; then
  result=$(node -e 'const fs=require("fs"); const artifact=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(artifact.result || "");' "$artifact_path")
  if [ "$result" = "FAIL" ]; then
    echo ""
    echo "==> Review triage"
    node "$triage_script" triage
  fi
fi
