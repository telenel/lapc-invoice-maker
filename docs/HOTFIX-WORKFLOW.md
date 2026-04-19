# Hotfix Workflow

Use this lane for small production fixes that need to move faster than the full PR -> CI -> webhook path.

This is not a bypass of build safety. The hotfix lane still:

- runs local preflight checks
- deploys through the existing build-first VPS script
- verifies the live `/api/version` response
- runs lightweight route smoke checks on the VPS
- pins the exact remote SHA before SSH
- rolls back automatically on remote deploy failure

## Allowed Use

Good candidates:

- public page bugs
- small API logic fixes
- UI regressions
- copy/validation fixes

Do not use this lane for:

- Prisma migrations
- env var changes
- Dockerfile/base image changes
- infrastructure changes
- large refactors

## Setup

Create a local `.env.hotfix` from [.env.hotfix.example](/Users/montalvo/lapc-invoice-maker/.env.hotfix.example):

```bash
cp .env.hotfix.example .env.hotfix
```

Required values:

- `HOTFIX_SSH_HOST`

Common optional values:

- `HOTFIX_SSH_USER`
- `HOTFIX_SSH_PORT`
- `HOTFIX_REMOTE_PROJECT_DIR`
- `HOTFIX_APP_URL`
- `HOTFIX_TEST_COMMAND`

## Commands

Run the reduced local validation:

```bash
npm run hotfix:preflight
```

Run preflight with a focused test command:

```bash
HOTFIX_TEST_COMMAND='npm test -- src/__tests__/public-quote-view.test.tsx' npm run hotfix:preflight
```

Deploy a pushed branch or tag directly to the VPS:

```bash
npm run hotfix:deploy -- hotfix/my-fix-branch
```

Deploy `main`:

```bash
npm run hotfix:deploy -- main
```

Preview the remote command without deploying:

```bash
npm run hotfix:deploy -- --dry-run hotfix/my-fix-branch
```

Skip local preflight if you already ran it:

```bash
npm run hotfix:deploy -- --skip-preflight hotfix/my-fix-branch
```

## How It Works

1. `scripts/hotfix-deploy.sh` checks that the target branch or tag exists on `origin`.
2. If you are deploying your current branch, it blocks when local commits have not been pushed yet.
3. It runs `scripts/hotfix-preflight.sh` unless `--skip-preflight` is used.
4. It SSHes to the VPS and runs `scripts/deploy-webhook.sh <ref>`.
5. The VPS fetches that ref, verifies that it still resolves to the exact SHA selected locally, resets to that commit, skips only if the live app already reports that SHA and smoke checks pass, otherwise builds the app image, runs Prisma migrations as a preflight step, replaces the container only after those migrations succeed, verifies `/api/version`, runs smoke checks, and rolls back automatically if post-swap verification fails.

## Notes

- The remote deploy script now accepts a target ref. Without one, it still defaults to `main`.
- Hotfix deploys are intentionally branch/tag based. Push the exact ref you want live before deploying. The local script captures the remote SHA first, and the VPS refuses to deploy if the ref moves before fetch.
- Every remote deploy outcome is appended to `.deploy-history.log` on the VPS for auditability.
- `npm run ship-check` remains the normal branch validation path for PRs and regular deploys.
