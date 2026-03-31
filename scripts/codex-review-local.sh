#!/bin/bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
git_dir=$(git rev-parse --git-dir)
stamp_dir="$git_dir/laportal"
stamp_file="$stamp_dir/codex-review.env"
output_file="$stamp_dir/codex-review.txt"
prompt_file="$repo_root/.codex/prompts/local-review.md"
base_ref="${1:-main}"
review_model="gpt-5.4-mini"
review_reasoning="high"

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

tmp_prompt=$(mktemp)
trap 'rm -f "$tmp_prompt"' EXIT

runtime_files=()
test_files=()
docs_files=()
other_files=()

while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in
    src/*|prisma/*)
      runtime_files+=("$path")
      ;;
    tests/*|src/__tests__/*|vitest.config.ts)
      test_files+=("$path")
      ;;
    docs/*|README.md|AGENTS.md|.codex/prompts/*)
      docs_files+=("$path")
      ;;
    *)
      other_files+=("$path")
      ;;
  esac
done < <(git diff --name-only "$base_ref...HEAD")

{
  cat "$prompt_file"
  printf '\n\n'
  printf 'Review context prepared by the wrapper:\n'
  printf '- HEAD: %s\n' "$head_sha"
  printf '- Base ref: %s\n' "$base_ref"
  printf '- Review model: %s\n' "$review_model"
  printf '- Review reasoning effort: %s\n' "$review_reasoning"
  printf '\n'
  printf 'Changed runtime files:\n'
  if [ "${#runtime_files[@]}" -eq 0 ]; then
    printf '- none\n'
  else
    printf '%s\n' "${runtime_files[@]}" | sed 's/^/- /'
  fi
  printf '\n'
  printf 'Changed test files:\n'
  if [ "${#test_files[@]}" -eq 0 ]; then
    printf '- none\n'
  else
    printf '%s\n' "${test_files[@]}" | sed 's/^/- /'
  fi
  printf '\n'
  printf 'Changed docs and prompt files:\n'
  if [ "${#docs_files[@]}" -eq 0 ]; then
    printf '- none\n'
  else
    printf '%s\n' "${docs_files[@]}" | sed 's/^/- /'
  fi
  printf '\n'
  printf 'Other changed files:\n'
  if [ "${#other_files[@]}" -eq 0 ]; then
    printf '- none\n'
  else
    printf '%s\n' "${other_files[@]}" | sed 's/^/- /'
  fi
  printf '\n'
  printf 'Wrapper instructions:\n'
  printf '- Start with changed runtime files, then changed tests.\n'
  printf '- Open docs and prompt files only if needed to resolve runtime behavior or workflow meaning.\n'
  printf '- Planning files under docs/superpowers are low-priority context, not primary review targets.\n'
  printf '- Use targeted per-file diffs before reopening the full branch diff.\n'
} > "$tmp_prompt"

echo "==> Reviewing branch diff relative to $base_ref"
CODEX_REVIEW_BASE_REF="$base_ref" \
codex exec \
  --model "$review_model" \
  -c "model_reasoning_effort=\"$review_reasoning\"" \
  --skip-git-repo-check \
  --cd "$repo_root" \
  --output-last-message "$output_file" \
  --sandbox read-only < "$tmp_prompt"

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
