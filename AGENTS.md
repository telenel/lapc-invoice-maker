# LAPortal Codex Guide

Codex should use `docs/AI-WORKFLOW.md` as the shared workflow authority for this repo.

## Read First

1. `README.md`
2. `docs/PROJECT-OVERVIEW.md`
3. `docs/AI-WORKFLOW.md`
4. `prisma/schema.prisma` for data model changes

## Codex Notes

- Codex is supported on this repo alongside Claude Code.
- Follow the shared rules in `docs/AI-WORKFLOW.md` for setup, validation, git workflow, and architecture boundaries.
- Worktrees are allowed and may be used when they are convenient for isolating or organizing work.
- Before starting, committing, pushing, or opening a PR, provide a brief status summary that includes the active worktree path, current branch, upstream tracking branch if any, and PR state if any.
- Use the repo validation commands from `docs/AI-WORKFLOW.md`: `npm run ship-check` and `npm run review:codex`.
- Codex may publish a reviewed branch with `./scripts/publish-pr.sh`.
