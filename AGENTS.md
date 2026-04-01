# LAPortal Guide

## Read First

1. `README.md`
2. `docs/PROJECT-OVERVIEW.md`
3. `prisma/schema.prisma` for data model changes

## Notes

- Worktrees are allowed and may be used when they are convenient for isolating or organizing work.
- Use the repo validation command before handing changes back.

## Branching And PRs

- Start each feature from a fresh `main`: `git checkout main && git pull`.
- Create one focused branch per concern: `git checkout -b feat/thing`.
- Keep branches short-lived and do not stack branches.
- Commit often, but keep each commit scoped to the branch's one concern.
- Run `npm run ship-check` before pushing.
- Push the branch when the work is ready for PR review.
- Let CodeRabbit and CI review the PR.
- Merge before starting the next feature.
