# AI Agent Workflow

Use this file as the quick handoff document for LAPortal PRs, deploys, and VPS-aware fixes.

## PR Workflow

- Own the PR until it is actually unblocked.
- Batch-fix actionable review findings when possible.
- Run local verification before pushing when the change touches app behavior.
- After pushing, resolve the specific CodeRabbit or review thread that was fixed.
- Do not add top-level PR comments unless a human actually needs context.
- Once a PR exists, further pushes are follow-up fixes only: use `CR_FIX=1 git push`.
- Merge with squash.

## Deploy Facts

- Production URL: `https://laportal.montalvo.io`
- Deploy webhook: `https://montalvo.io/hooks/deploy-laportal`
- Build verification URL: `https://laportal.montalvo.io/api/version`
- VPS checkout: `/opt/lapc-invoice-maker`
- Host deploy entrypoint: `/opt/deploy-webhook.sh`
- Live deploy service: `webhook.service`

Legacy naming remains in the VPS path and Docker Compose project (`lapc-invoice-maker`). That is expected.

## What Changed Recently

- Docker builds were fixed by copying `scripts/postinstall.js` before `npm ci`.
- Production deploys now verify the live `buildSha` instead of checking for any `200` response.
- The VPS deploy script now rolls back on failed replacement or failed verification.
- GitHub Actions now waits longer and tolerates transient startup `404` responses during deploy verification.
- PDF generation uses direct Chromium CLI rendering, not a Puppeteer browser launch.
- Admin onboarding/reset now reveals a one-time temporary password to admins in the UI.

## Production Rules

- If you change deploy behavior, update both repo docs and the actual VPS script path assumptions.
- If you hotfix production directly on the VPS, mirror the same change into the repo immediately and merge it.
- Verify production with `/api/version`, not only HTTP reachability.
- Do not assume the separate Bun automation service is the LAPortal deploy path. It is not.
