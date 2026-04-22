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

## Agent CLI Hygiene

- For non-interactive Claude or Codex runs, redirect stdin from `/dev/null` unless you intentionally want stdin appended to the prompt.
- Keep planning prompts short and single-purpose. Split planning, implementation, and review into separate runs instead of one giant prompt.
- Avoid bypass-permission flags in normal runs; work from a trusted repo root and use `--cd` or shell `cd` instead.
- Treat `Reading additional input from stdin...` from Codex as a noisy CLI warning, not a failure, when the exit code and final output are correct.
- Use `codex review --uncommitted` for the current working tree, or `codex review --base <branch>` when comparing against a branch tip.
- Use the CLI exit code and final response as the success signal; do not treat startup stdin warnings as success or failure by themselves.

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
