# LAPortal Workflow

## Read First

1. [README.md](../../README.md)
2. [docs/PROJECT-OVERVIEW.md](../PROJECT-OVERVIEW.md)
3. [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md) for infrastructure work
4. [docs/ai/SUPABASE-HANDOFF.md](SUPABASE-HANDOFF.md) for Claude-facing Supabase context
5. [prisma/schema.prisma](../../prisma/schema.prisma) for model changes

## Validation

- Run `npm run ship-check` before handing off changes when the tree is clean enough for it.
- If a repo script refuses to run because the tree is intentionally dirty, state that explicitly and run the nearest safe validation commands.

## Git Workflow

- Read [docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md) before starting repo changes.
- GitHub is the source of truth. Treat local branches as disposable caches.
- One branch has one active writer at a time across all machines and agents.
- Start new work with `npm run git:start-branch -- <branch>`.
- Resume remote work with `npm run git:resume-branch -- <branch>`.
- If GitHub should intentionally replace the local branch copy, use `npm run git:resume-branch -- --discard-local <branch>`.
- Once a PR exists, that branch is for review fixes only. New scope goes on a new branch.

## Infra Rules

- Do not assume runtime env is enough for Next.js public Supabase config. Verify build-time env through `/api/version`.
- Do not set `SUPABASE_SCHEDULER_CONFIRMED=true` until Supabase cron jobs are explicitly verified.
- Do not migrate auth off NextAuth as a side effect of unrelated Supabase work.
- Do not disable `ALLOW_LEGACY_FILESYSTEM_FALLBACK` until `npm run audit:legacy-documents` is clean.
- Treat Supabase scheduler ownership as optional infrastructure work, not a required migration step.

## Documentation

When infrastructure behavior changes, update the durable docs:

- [README.md](../../README.md)
- [docs/PROJECT-OVERVIEW.md](../PROJECT-OVERVIEW.md)
- [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md)
- [docs/ai/SUPABASE-HANDOFF.md](SUPABASE-HANDOFF.md)
