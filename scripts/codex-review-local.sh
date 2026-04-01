#!/bin/bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
git_dir=$(git rev-parse --git-dir)
stamp_dir="$git_dir/laportal"
stamp_file="$stamp_dir/codex-review.env"
output_file="$stamp_dir/codex-review.txt"
json_file="$stamp_dir/codex-review.json"
history_dir="$stamp_dir/review-history"
prompt_file="$repo_root/.codex/prompts/local-review.md"
helper_script="$repo_root/scripts/codex-review-artifact.mjs"
base_ref="main"
json_mode=0
base_ref_explicit=0
focus_paths=()

cd "$repo_root"

usage() {
  cat <<'EOF'
Usage: ./scripts/codex-review-local.sh [base-ref] [--json] [--base-ref <ref>] [--focus <path>]...

Options:
  --json            Print the latest structured JSON artifact to stdout after review.
  --base-ref <ref>  Override the base ref to diff against. Default: main.
  --focus <path>    Limit review scope to changed files that match the provided path.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --json)
      json_mode=1
      shift
      ;;
    --base-ref)
      if [ $# -lt 2 ]; then
        echo "BLOCKED: --base-ref requires a value."
        exit 1
      fi
      base_ref="$2"
      base_ref_explicit=1
      shift 2
      ;;
    --focus)
      if [ $# -lt 2 ]; then
        echo "BLOCKED: --focus requires a value."
        exit 1
      fi
      focus_paths+=("$2")
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      echo "BLOCKED: unknown option '$1'"
      usage
      exit 1
      ;;
    *)
      if [ "$base_ref_explicit" -eq 0 ] && [ "$base_ref" = "main" ]; then
        base_ref="$1"
        base_ref_explicit=1
        shift
      else
        echo "BLOCKED: unexpected argument '$1'"
        usage
        exit 1
      fi
      ;;
  esac
done

log() {
  if [ "$json_mode" -eq 1 ]; then
    printf '%s\n' "$*" >&2
  else
    printf '%s\n' "$*"
  fi
}

if ! command -v codex >/dev/null 2>&1; then
  echo "BLOCKED: codex CLI is required for local review."
  exit 1
fi

if [ ! -f "$prompt_file" ]; then
  echo "BLOCKED: missing prompt file at $prompt_file"
  exit 1
fi

if [ ! -f "$helper_script" ]; then
  echo "BLOCKED: missing review helper at $helper_script"
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
runtime_prompt=$(mktemp "${TMPDIR:-/tmp}/codex-review-prompt.XXXXXX")
cleanup() {
  rm -f "$runtime_prompt"
}
trap cleanup EXIT

changed_files=()
while IFS= read -r changed_file; do
  changed_files+=("$changed_file")
done < <(git diff --name-only "$base_ref...HEAD")

if [ "${#focus_paths[@]}" -gt 0 ]; then
  reviewed_files=()
  while IFS= read -r reviewed_file; do
    reviewed_files+=("$reviewed_file")
  done < <(git diff --name-only "$base_ref...HEAD" -- "${focus_paths[@]}")
  if [ "${#reviewed_files[@]}" -eq 0 ]; then
    echo "BLOCKED: none of the focused paths match files changed relative to $base_ref."
    exit 1
  fi
else
  reviewed_files=("${changed_files[@]}")
fi

mkdir -p "$stamp_dir"
rm -f "$output_file" "$json_file"

build_prompt_cmd=(
  node "$helper_script" build-prompt
  --template "$prompt_file"
  --output "$runtime_prompt"
  --base-ref "$base_ref"
  --head-sha "$head_sha"
)

if [ "${#focus_paths[@]}" -gt 0 ]; then
  for focus_path in "${focus_paths[@]}"; do
    build_prompt_cmd+=(--focus "$focus_path")
  done
fi

if [ "${#changed_files[@]}" -gt 0 ]; then
  for changed_file in "${changed_files[@]}"; do
    build_prompt_cmd+=(--changed-file "$changed_file")
  done
fi

if [ "${#reviewed_files[@]}" -gt 0 ]; then
  for reviewed_file in "${reviewed_files[@]}"; do
    build_prompt_cmd+=(--reviewed-file "$reviewed_file")
  done
fi

"${build_prompt_cmd[@]}"

log "==> Reviewing branch diff relative to $base_ref"
if [ "${#focus_paths[@]}" -gt 0 ]; then
  log "==> Focused review paths: ${focus_paths[*]}"
fi
CODEX_REVIEW_BASE_REF="$base_ref" \
CODEX_REVIEW_HEAD="$head_sha" \
codex exec \
  --skip-git-repo-check \
  --cd "$repo_root" \
  --output-last-message "$output_file" \
  --sandbox read-only < "$runtime_prompt" >&2

if [ ! -s "$output_file" ]; then
  echo "BLOCKED: Codex review produced no output."
  exit 1
fi

clean_output_file=$(mktemp "${TMPDIR:-/tmp}/codex-review-output.XXXXXX")
cleanup_clean_output() {
  rm -f "$clean_output_file"
}
trap cleanup_clean_output EXIT

awk '!/^LIVE-FINDING:/' "$output_file" > "$clean_output_file"
mv "$clean_output_file" "$output_file"
trap - EXIT

result=$(awk -F': ' '/^RESULT:/ {print $2; exit}' "$output_file")
summary=$(awk -F': ' '/^SUMMARY:/ {print $2; exit}' "$output_file")

case "$result" in
  PASS|FAIL) ;;
  *)
    log ""
    log "BLOCKED: Codex review output was missing a valid RESULT line."
    exit 1
    ;;
esac

record_cmd=(
  node "$helper_script" record
  --text-report "$output_file"
  --json-report "$json_file"
  --history-dir "$history_dir"
  --head-sha "$head_sha"
  --base-ref "$base_ref"
  --created-at "$timestamp"
)

if [ "${#focus_paths[@]}" -gt 0 ]; then
  for focus_path in "${focus_paths[@]}"; do
    record_cmd+=(--focus "$focus_path")
  done
fi

if [ "${#changed_files[@]}" -gt 0 ]; then
  for changed_file in "${changed_files[@]}"; do
    record_cmd+=(--changed-file "$changed_file")
  done
fi

if [ "${#reviewed_files[@]}" -gt 0 ]; then
  for reviewed_file in "${reviewed_files[@]}"; do
    record_cmd+=(--reviewed-file "$reviewed_file")
  done
fi

"${record_cmd[@]}"

if [ "$json_mode" -eq 1 ]; then
  cat "$json_file"
else
  cat "$output_file"
fi

{
  printf 'CODEX_REVIEW_HEAD=%q\n' "$head_sha"
  printf 'CODEX_REVIEW_BASE_REF=%q\n' "$base_ref"
  printf 'CODEX_REVIEW_RESULT=%q\n' "$result"
  printf 'CODEX_REVIEW_SUMMARY=%q\n' "$summary"
  printf 'CODEX_REVIEW_CREATED_AT=%q\n' "$timestamp"
  printf 'CODEX_REVIEW_TEXT_FILE=%q\n' "$output_file"
  printf 'CODEX_REVIEW_JSON_FILE=%q\n' "$json_file"
} > "$stamp_file"

log ""
if [ "$result" = "PASS" ]; then
  log "Recorded Codex PASS stamp for HEAD $head_sha"
else
  log "Recorded Codex FAIL stamp for HEAD $head_sha"
fi
log "Stamp file: $stamp_file"
log "Text report: $output_file"
log "JSON artifact: $json_file"
log "History dir: $history_dir"
