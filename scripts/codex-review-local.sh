#!/bin/bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
git_dir=$(git rev-parse --git-dir)
stamp_dir="$git_dir/laportal"
stamp_file="$stamp_dir/codex-review.env"
output_file="$stamp_dir/codex-review.txt"
prompt_file="$repo_root/.codex/prompts/local-review.md"
base_ref="${1:-main}"

cd "$repo_root"

if ! command -v codex >/dev/null 2>&1; then
  echo "BLOCKED: codex CLI is required for local review."
  exit 1
fi

if [ ! -f "$prompt_file" ]; then
  echo "BLOCKED: missing prompt file at $prompt_file"
  exit 1
fi

if ! git rev-parse --verify "$base_ref^{commit}" >/dev/null 2>&1; then
  echo "BLOCKED: base ref '$base_ref' does not exist locally."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "BLOCKED: local Codex review requires a clean working tree."
  echo "Commit or stash changes first so Codex reviews the exact HEAD that will be published."
  echo ""
  git status --short --branch
  exit 1
fi

head_sha=$(git rev-parse HEAD)
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$stamp_dir"
rm -f "$output_file"

echo "==> Reviewing branch diff relative to $base_ref"
CODEX_REVIEW_BASE_REF="$base_ref" \
codex exec \
  --skip-git-repo-check \
  --cd "$repo_root" \
  --output-last-message "$output_file" \
  --sandbox read-only < "$prompt_file"

if [ ! -s "$output_file" ]; then
  echo "BLOCKED: Codex review produced no output."
  exit 1
fi

result=$(awk -F': ' '/^RESULT:/ {print $2; exit}' "$output_file")
summary=$(awk -F': ' '/^SUMMARY:/ {print $2; exit}' "$output_file")

cat "$output_file"

case "$result" in
  PASS|FAIL) ;;
  *)
    echo ""
    echo "BLOCKED: Codex review output was missing a valid RESULT line."
    exit 1
    ;;
esac

{
  printf 'CODEX_REVIEW_HEAD=%q\n' "$head_sha"
  printf 'CODEX_REVIEW_BASE_REF=%q\n' "$base_ref"
  printf 'CODEX_REVIEW_RESULT=%q\n' "$result"
  printf 'CODEX_REVIEW_SUMMARY=%q\n' "$summary"
  printf 'CODEX_REVIEW_CREATED_AT=%q\n' "$timestamp"
} > "$stamp_file"

if [ "$result" != "PASS" ]; then
  echo ""
  echo "BLOCKED: Codex review returned FAIL for HEAD $head_sha"
  echo "Stamp file: $stamp_file"
  exit 1
fi

echo ""
echo "Recorded Codex PASS stamp for HEAD $head_sha"
echo "Stamp file: $stamp_file"
