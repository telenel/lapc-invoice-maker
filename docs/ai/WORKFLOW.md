# LAPortal Workflow

## Read Order

1. `README.md`
2. `docs/PROJECT-OVERVIEW.md`
3. `docs/ai/PROJECT-CONTEXT.md`
4. `docs/ai/WORKFLOW.md`
5. `docs/ai/SESSION-LOG.md`
6. `prisma/schema.prisma` when data model work is involved

## Daily Flow

1. Start work with `./scripts/ai/start-work.sh <agent> "<task>"`.
2. Work in the current checked-out branch unless the user explicitly asks for branch changes.
3. Run the required validation.
4. Finish work with `./scripts/ai/finish-work.sh <agent> "<summary>"`.
5. Commit the work unless the user explicitly says not to commit.

## Git And PR Rules

- Claude Code and Codex are both supported on this repo.
- Do not use git worktrees on this repo.
- Default workflow is local implementation followed by local Codex review and scripted PR publication.
- Never push or deploy without explicit user approval.
- Once a PR exists, do not keep pushing new feature work to that branch.
- The only normal exception is CodeRabbit follow-up fixes with `CR_FIX=1 git push`.
- `gh` should be installed and authenticated because the tracked pre-push hook checks open PR state and the repo uses scripted PR publishing.

## Validation

- `npm run ship-check`
  Canonical validation flow
- `npm run review:codex`
  Run only when explicitly asked for the Codex review wrapper
- `npx prisma generate`
  Rerun after Prisma schema or dependency changes

## CodeRabbit And Review Flow

- Shared CodeRabbit automation should be documented through the repo workflow files.
- Use Autofix for unresolved CodeRabbit findings.
- Use custom recipes for recurring cleanup work.
- Prefer isolated follow-up fixes over mixing feature work into an active PR branch.
