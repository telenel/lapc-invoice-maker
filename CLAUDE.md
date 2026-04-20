# LAPortal Guide

## Read first

1. `README.md`
2. `docs/PROJECT-OVERVIEW.md`
3. `docs/GIT-WORKFLOW.md`
4. `docs/SUPABASE-MIGRATION-STATUS.md` for infra/deploy work
5. `prisma/schema.prisma` for data model changes

## Notes

- Worktrees are allowed.
- GitHub is the source of truth. Local branches are disposable caches.
- One branch has one active writer at a time across all machines and agents.
- `npm run ship-check` is the repo validation command, and it requires a completely clean tree.

## Branching and PRs

- start each machine with `npm install` and `npm run git:bootstrap`
- start new work from fresh `main` with `npm run git:start-branch -- feat/thing`
- resume an existing remote branch with `npm run git:resume-branch -- feat/thing`
- use `npm run git:resume-branch -- --discard-local feat/thing` only when GitHub should overwrite the local copy
- keep one focused branch per concern
- run `npm run ship-check` before pushing
- open the PR with `npm run git:publish-pr`
- after a PR exists, only push review fixes with `CR_FIX=1 git push`
- let CI and normal PR review happen on GitHub
- merge before starting the next feature
