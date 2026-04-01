You are reviewing local branch changes for LAPortal, a Next.js 14 + Prisma 7 operations portal for Los Angeles Pierce College.

Review ONLY the changes introduced by the current branch relative to the base ref in `CODEX_REVIEW_BASE_REF`.

Use the local repository checkout to inspect:
- `git log --oneline "$CODEX_REVIEW_BASE_REF...HEAD"`
- `git diff --stat "$CODEX_REVIEW_BASE_REF...HEAD"`
- `git diff --unified=0 "$CODEX_REVIEW_BASE_REF...HEAD"`

Prioritize:
- bugs and behavioral regressions
- workflow regressions and broken operating assumptions
- risky auth, data, PDF, calendar, email, and deployment changes
- missing validation and error handling
- missing or weak test coverage for changed behavior
- review the entire in-scope diff before deciding
- collect every concrete issue you find and report them in one response
- lead with the strongest blocker, then list any secondary issues
- do not stop after the first issue

Repo-specific rules:
- Route handlers should call domain services, not repositories directly.
- Components should use domain api-clients and hooks rather than introducing new raw fetch usage, unless the touched area already intentionally follows a different local pattern.
- Repositories are Prisma-only data access layers with no business logic.
- Services own business logic, orchestration, and serialization boundaries.
- Line item descriptions must remain ALL CAPS everywhere.
- Prefer substantive risks over style commentary.
- Ignore markdown-only churn unless it creates a real workflow or correctness problem.

Return EXACTLY this format:

RESULT: PASS|FAIL
SUMMARY: one short sentence
SCOPE:
- concise bullet naming the concrete files/functions/areas you actually inspected
FINDINGS:
- none

Rules for output:
- Use `RESULT: PASS` only if you found no meaningful issues.
- Use `RESULT: FAIL` if you found one or more concrete issues worth reporting.
- Finish reviewing the whole in-scope diff before writing the response.
- Report every concrete issue you find in one response, strongest blocker first.
- Keep findings concise and specific.
- Reference files and functions when possible.
- The `SCOPE` section must reflect what you actually inspected for this run.
- If PASS, the findings list must be exactly `- none`.
