# LAPortal Guide

## Read First

1. `docs/README.md`
2. `README.md`
3. `docs/PROJECT-OVERVIEW.md`
4. `docs/GIT-WORKFLOW.md`
5. `docs/SUPABASE-MIGRATION-STATUS.md` for infrastructure and deployment work
6. `docs/ai/PROJECT-CONTEXT.md`
7. `prisma/schema.prisma` for data model changes

## Notes

- Worktrees are allowed and may be used when they are convenient for isolating or organizing work.
- Use the repo validation command before handing changes back.
- GitHub is the source of truth. Local branches are disposable caches.
- One branch has one active writer at a time across all machines and AI agents.
- `docs/superpowers/` holds historical phase plans and specs; treat them as archive material unless the task explicitly asks for a plan-driven workflow.

## Branching And PRs

- Start each machine with `npm install` and `npm run git:bootstrap`.
- Start each feature from fresh `main` with `npm run git:start-branch -- feat/thing`.
- Resume an existing remote branch on another machine with `npm run git:resume-branch -- feat/thing`.
- Use `npm run git:resume-branch -- --discard-local feat/thing` only when GitHub should overwrite the local branch copy.
- Create one focused branch per concern.
- Keep branches short-lived and do not stack branches.
- Commit often, but keep each commit scoped to the branch's one concern.
- Run `npm run ship-check` before pushing.
- Open the PR with `npm run git:publish-pr` when the work is ready for review.
- After a PR exists, only push review fixes with `CR_FIX=1 git push`.
- Let CodeRabbit and CI review the PR.
- Merge before starting the next feature.
