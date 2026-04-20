# LAPortal Workflow

## Read First

1. [docs/README.md](../README.md)
2. [docs/PROJECT-OVERVIEW.md](../PROJECT-OVERVIEW.md)
3. [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md) for infrastructure work
4. [docs/ai/SUPABASE-HANDOFF.md](SUPABASE-HANDOFF.md) for Supabase-specific context
5. [prisma/schema.prisma](../../prisma/schema.prisma) for model changes

## Validation

- Run `npm run ship-check` before handing off changes when the tree is clean enough for it.
- If the tree is intentionally dirty, say so explicitly and run the nearest safe validation commands instead of pretending the full gate passed.

## Git Workflow

- Read [docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md) before changing repo code.
- GitHub is the source of truth. Local branches are disposable caches.
- One branch has one active writer at a time across all machines and agents.
- Start new work with `npm run git:start-branch -- <branch>`.
- Resume remote work with `npm run git:resume-branch -- <branch>`.
- If GitHub should intentionally replace the local branch copy, use `npm run git:resume-branch -- --discard-local <branch>`.
- Once a PR exists, that branch is for review fixes only.

## Infra Rules

- Do not assume runtime env is enough for Next.js public Supabase config. Verify build-time env through `/api/version`.
- Do not set `SUPABASE_SCHEDULER_CONFIRMED=true` until Supabase cron jobs are explicitly verified.
- Do not migrate auth off NextAuth as a side effect of unrelated Supabase work.
- Do not disable `ALLOW_LEGACY_FILESYSTEM_FALLBACK` until `npm run audit:legacy-documents` is clean.
- Treat Supabase scheduler ownership as optional infrastructure work, not a required migration step.

## Documentation Rules

- When behavior changes, update the durable docs together: `README.md`, `docs/README.md`, `docs/PROJECT-OVERVIEW.md`, and the relevant AI handoff file.
- Historical phase plans and specs under `docs/superpowers/` are archival records, not the active source of truth for current implementation.

## Working Habit

- Read the code directly when docs are missing or stale.
- Prefer the current route handlers and domain services over old phase notes when you need to answer how the app works today.
