# Hotfix Workflow

Use this lane for small production fixes that need to ship faster than the normal branch -> PR -> merge -> deploy path.

This is a faster entry point, not a weaker deploy path.

The hotfix lane still:

- runs local preflight checks unless explicitly skipped
- pins the exact remote SHA before SSH
- uses the same VPS deploy engine as normal deploys
- verifies `/api/version`
- runs smoke checks
- rolls back automatically on post-swap failure

## Good use cases

- public page bugs
- small API logic fixes
- UI regressions
- copy/validation fixes
- narrow production patches that do not change infra assumptions

## Do not use this lane for

- migration-led changes
- env var changes
- Dockerfile/base image changes
- infrastructure changes
- large refactors

Note: the remote deploy path still runs pending Prisma migrations and repo-specific invariant checks as a safety preflight. The rule above means you should not choose the hotfix lane for changes whose primary purpose is schema or infra rollout.

## Setup

Create a local `.env.hotfix` from the repo example:

```bash
cp .env.hotfix.example .env.hotfix
```

Required:

- `HOTFIX_SSH_HOST`

Common optional values:

- `HOTFIX_SSH_USER`
- `HOTFIX_SSH_PORT`
- `HOTFIX_REMOTE_PROJECT_DIR`
- `HOTFIX_APP_URL`
- `HOTFIX_TEST_COMMAND`

## Commands

Run reduced local validation:

```bash
npm run hotfix:preflight
```

Run preflight with a focused test command:

```bash
HOTFIX_TEST_COMMAND='npm test -- src/__tests__/public-quote-view.test.tsx' npm run hotfix:preflight
```

Deploy a pushed branch or tag:

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

## What `hotfix:preflight` does

- `npm run lint`
- optional focused test command from args or `HOTFIX_TEST_COMMAND`
- `npm run build`

Unlike `ship-check`, this preflight does not require a totally clean working tree.

## What `hotfix:deploy` does

1. loads `.env.hotfix` if present
2. resolves the target ref on `origin`
3. if you are deploying the current branch, blocks if local commits have not been pushed
4. runs `hotfix:preflight` unless `--skip-preflight` is used
5. SSHes to the VPS and runs `scripts/deploy-webhook.sh <ref>` with `DEPLOY_CHANNEL=hotfix` and the exact remote SHA
6. waits for `/api/version` to report the expected short SHA

## Remote deploy behavior

`scripts/deploy-webhook.sh` is the real deployment engine used by both normal and hotfix deploys.

It:

1. fetches the target ref
2. rejects the deploy if the fetched SHA does not match the pinned expected SHA
3. skips rebuild only if the live app already serves that SHA and smoke checks pass
4. otherwise builds the candidate image
5. runs pre-swap migration/invariant checks in the candidate image:
   - `prisma migrate deploy`
   - `node scripts/check-products-derived-view.mjs`
6. swaps containers only after the preflight succeeds
7. verifies `/api/version`
8. runs `scripts/deploy-smoke-check.sh`
9. rolls back on post-swap failure

## Notes

- Hotfix deploys are intentionally branch/tag based. Push the exact ref you want live before deploying.
- Every deploy outcome is appended to `.deploy-history.log` on the VPS.
- `npm run ship-check` remains the normal validation path for regular PR work.
