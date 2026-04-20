# LAPortal Workflow

## Read first

1. [README.md](../../README.md)
2. [docs/PROJECT-OVERVIEW.md](../PROJECT-OVERVIEW.md)
3. [docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md)
4. [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md) for infrastructure work
5. [docs/ai/SUPABASE-HANDOFF.md](SUPABASE-HANDOFF.md) for Supabase-specific notes
6. [prisma/schema.prisma](../../prisma/schema.prisma) for model changes

## Validation

- Prefer `npm run ship-check` before handoff when the working tree is clean enough for it.
- `ship-check` requires a completely clean tree, including no untracked files.
- If a repo script is intentionally blocked by a dirty tree, state that explicitly and run the nearest safe validation commands instead.

## Git workflow

- Read [docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md) before editing repo code.
- GitHub is the source of truth. Treat local branches as disposable caches.
- One branch has one active writer at a time across all machines and agents.
- Start new work with `npm run git:start-branch -- <branch>`.
- Resume remote work with `npm run git:resume-branch -- <branch>`.
- If GitHub should intentionally replace the local branch copy, use `npm run git:resume-branch -- --discard-local <branch>`.
- Once a PR exists, that branch is for review fixes only. New scope goes on a new branch.
- Open PRs with `npm run git:publish-pr` after `ship-check` passes.

## Infra rules

- Do not assume runtime env is enough for Next.js public Supabase config. Verify build-time env through `/api/version`.
- Do not set `SUPABASE_SCHEDULER_CONFIRMED=true` until the protected scheduler route is explicitly verified for the chosen environment.
- Do not migrate auth off NextAuth as a side effect of unrelated Supabase work.
- Do not re-enable `ALLOW_LEGACY_FILESYSTEM_FALLBACK` unless an audit proves it is needed.
- Treat Supabase scheduler ownership as optional infrastructure work, not a prerequisite for the rest of the platform.

## Documentation

When durable behavior changes, update the durable docs:

- [README.md](../../README.md)
- [docs/PROJECT-OVERVIEW.md](../PROJECT-OVERVIEW.md)
- [docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md)
- [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md)
- [docs/ai/SUPABASE-HANDOFF.md](SUPABASE-HANDOFF.md)
