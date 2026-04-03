#!/bin/sh
set -eu

agent="${1:-unknown}"
summary="${2:-completed work}"
log_file="docs/ai/SESSION-LOG.md"
timestamp="$(date '+%Y-%m-%d %H:%M:%S %Z')"
branch="$(git symbolic-ref --short HEAD 2>/dev/null || printf 'detached-head')"

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
  printf "\n### Finish | %s\n" "$timestamp"
  printf "- Agent: `%s`\n" "$agent"
  printf "- Branch: `%s`\n" "$branch"
  printf "- Summary: %s\n" "$summary"
} >> "$log_file"
