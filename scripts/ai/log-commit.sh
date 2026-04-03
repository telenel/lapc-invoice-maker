#!/bin/sh
set -eu

msg_file="${1:?commit message file required}"
log_file="docs/ai/SESSION-LOG.md"
timestamp="$(date '+%Y-%m-%d %H:%M:%S %Z')"
branch="$(git symbolic-ref --short HEAD 2>/dev/null || printf 'detached-head')"
subject="$(sed -n '1p' "$msg_file" | tr -d '\r')"
files="$(git diff --cached --name-only | sed '/^$/d')"

mkdir -p "$(dirname "$log_file")"
if [ ! -f "$log_file" ]; then
  cat > "$log_file" <<'EOF'
# Session Log

This file is the running activity log for agent work in the repository.

## How To Use

- Start a task with `./scripts/ai/start-work.sh <agent> "<task>"`.
- Finish a task with `./scripts/ai/finish-work.sh <agent> "<summary>"`.
- The `commit-msg` hook will append commit activity automatically.

## Activity
EOF
fi

{
  printf "\n### Commit | %s\n" "$timestamp"
  printf -- '- Branch: `%s`\n' "$branch"
  printf -- '- Message: %s\n' "$subject"
  printf -- '- Files:\n'
  if [ -n "$files" ]; then
    printf '%s\n' "$files" | sed 's/^/  - `/; s/$/`/'
  else
    printf '  - `no staged files detected`\n'
  fi
} >> "$log_file"

git add "$log_file"
