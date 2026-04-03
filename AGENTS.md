# LAPortal Agent Guide

## Read First

1. `README.md`
2. `docs/PROJECT-OVERVIEW.md`
3. `docs/ai/PROJECT-CONTEXT.md`
4. `docs/ai/WORKFLOW.md`
5. `docs/ai/SESSION-LOG.md`
6. `prisma/schema.prisma` for data model changes

## Shared Rules

- `AGENTS.md` is the shared repo contract for Codex, Claude, and other coding agents.
- Start scoped work with `./scripts/ai/start-work.sh <agent> "<task>"`.
- Finish scoped work with `./scripts/ai/finish-work.sh <agent> "<summary>"`.
- Completed coding tasks should end with a git commit unless the user explicitly says not to commit.
- The `hooks/commit-msg` hook appends commit activity to `docs/ai/SESSION-LOG.md`.

## Repo Guardrails

- Claude Code and Codex are both supported on this repo.
- Do not use git worktrees on this repo.
- Use the repo validation command before handing changes back.
- Never push or deploy without explicit user approval.
- Once a PR exists, do not keep pushing new feature work to that branch except explicit CodeRabbit follow-up fixes.
