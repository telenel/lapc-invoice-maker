You are reviewing local branch changes for LAPortal, a Next.js 14 + Prisma 7 operations portal for Los Angeles Pierce College.

Review ONLY the changes introduced by the current branch relative to the base ref in `CODEX_REVIEW_BASE_REF`.

Use the local repository checkout to inspect:
- `git log --oneline "$CODEX_REVIEW_BASE_REF...HEAD"`
- `git diff --stat "$CODEX_REVIEW_BASE_REF...HEAD"`
- `git diff --unified=0 "$CODEX_REVIEW_BASE_REF...HEAD"`

Review workflow:
- Treat this as a whole-branch regression review, not a patch-style skim. You should survey all changed runtime behavior, but do that by following the changed code paths rather than re-reading broad repo background docs.
- Start from the changed-file list and touched hunks, then open only the changed files and the smallest set of adjacent routes/services/hooks/tests needed to verify behavior.
- Do not re-read `README.md`, `docs/PROJECT-OVERVIEW.md`, or `docs/AI-WORKFLOW.md` unless one of those files changed in the diff or you need them to resolve a specific ambiguity that blocks a finding.
- Ignore planning/spec docs such as `docs/superpowers/**` unless they are the only evidence that a code change intentionally altered behavior.
- Prefer targeted file diffs like `git diff -- <path>` or `git show "$CODEX_REVIEW_BASE_REF:<path>"` over reopening the full branch diff repeatedly.
- Avoid redundant reads. If you already inspected a file for the current question, move to the next unresolved risk instead of re-opening the same file without a new purpose.
- Quote shell paths correctly, especially paths with brackets like `src/app/quotes/[id]/edit/page.tsx`.

Prioritize:
- bugs and behavioral regressions
- workflow regressions and broken operating assumptions
- risky auth, data, PDF, calendar, email, and deployment changes
- missing validation and error handling
- missing or weak test coverage for changed behavior

Repo-specific rules:
- Route handlers should call domain services, not repositories directly.
- Components should use domain api-clients and hooks rather than introducing new raw fetch usage, unless the touched area already intentionally follows a different local pattern.
- Repositories are Prisma-only data access layers with no business logic.
- Services own business logic, orchestration, and serialization boundaries.
- Line item descriptions must remain ALL CAPS everywhere.
- Prefer substantive risks over style commentary.
- Ignore markdown-only churn unless it creates a real workflow or correctness problem.
- When a new client filter, link, or saved view is introduced, verify the full contract end-to-end: URL state, api-client params, route parsing, auth scoping, service filters, export paths, and tests.
- When new validation or dialogs are introduced, verify that the displayed UI rules still match the actual save/finalize route behavior.

Return EXACTLY this format:

RESULT: PASS|FAIL
SUMMARY: one short sentence
FINDINGS:
- none

Rules for output:
- Use `RESULT: PASS` only if you found no meaningful issues.
- Use `RESULT: FAIL` if you found one or more concrete issues worth blocking on.
- Keep findings concise and specific.
- Reference files and functions when possible.
- If PASS, the findings list must be exactly `- none`.
