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
- Do not use worktree-based isolation modes on this repo.
- Use the repo validation commands from `docs/AI-WORKFLOW.md`: `npm run lint`, `npm test`, `npm run build`.

## PR Review Ownership

When the user asks Codex to handle a PR, review findings, CodeRabbit comments, or merge readiness, Codex should own the review loop until the PR is actually unblocked or an external blocker remains.

Standard loop:

1. Inspect the latest PR state with GitHub CLI before editing.
2. Fix all compatible actionable findings that can be safely batched.
3. Run local validation using the repo commands from `docs/AI-WORKFLOW.md`. If the scope justifies narrower validation, state that explicitly.
4. Push the fix.
5. Resolve the specific review thread or conversation that the fix addressed.
6. Re-check CI, deployment status, and automated review state.
7. Repeat without waiting for another user prompt if new actionable bot findings appear.

Working rules:

- Do not stop after a single push when the task is to handle the PR.
- Do not add top-level PR comments unless the user explicitly asks for one or a real blocker must be explained to a human reviewer.
- Prefer resolving the specific review thread over leaving summary commentary.
- Only report back as "done" when required checks pass and only external blockers remain, such as human approval, stale bot state, or infrastructure outside the branch.
