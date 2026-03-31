# Deployment And Operations

This document is the current source of truth for LAPortal production deployment, VPS layout, and the operational fixes merged in `#67` and `#68`.

## Production Topology

- Public app: `https://laportal.montalvo.io`
- Public deploy trigger: `https://montalvo.io/hooks/deploy-laportal`
- Public build probe: `https://laportal.montalvo.io/api/version`
- VPS checkout: `/opt/lapc-invoice-maker`
- Host deploy entrypoint: `/opt/deploy-webhook.sh`
- Host deploy script target: `/opt/lapc-invoice-maker/scripts/deploy-webhook.sh`
- Compose project name: `lapc-invoice-maker`
- Main app container: `lapc-invoice-maker-app-1`
- Main database container: `lapc-invoice-maker-db-1`
- Reverse proxy/network: Traefik on external network `traefik-net`

The repo and containers still use legacy `lapc-invoice-maker` names after the LAPortal rebrand. Those names are confusing but currently intentional and not a deployment bug by themselves.

There is a separate Bun-based automation service on the VPS, but LAPortal production deploys do not use it. The live site deploy path is the `webhook.service` route above.

## Current Deploy Flow

1. A PR is merged into `main` with squash merge.
2. GitHub Actions runs `Lint, Build & Test`.
3. On successful `main` pushes, Actions POSTs to `https://montalvo.io/hooks/deploy-laportal`.
4. `webhook.service` executes `/opt/deploy-webhook.sh`.
5. The host script fetches `origin/main`, hard-resets `/opt/lapc-invoice-maker`, builds the Docker image with the short git SHA as `NEXT_PUBLIC_BUILD_SHA`, and recreates the app container.
6. Both the host script and GitHub Actions verify the deploy by polling `/api/version` until the reported `buildSha` matches the expected commit.

## Why The Deploy Process Changed

Two production issues were fixed.

### 1. Docker Build Was Failing On The VPS

The app has a `postinstall` hook:

```json
"postinstall": "node ./scripts/postinstall.js"
```

The previous Docker deps stage copied only `package.json` and `package-lock.json` before `npm ci`, so VPS builds failed because `scripts/postinstall.js` was not yet present in the image. The Dockerfile now copies `scripts/postinstall.js` into the deps stage before `npm ci`.

### 2. Successful Deploys Could Still Be Marked Failed

The older health check only proved that the site responded with `200`, which let stale containers look healthy. Then the first SHA-based health check window was still too short, so a correct deploy could finish after GitHub had already marked it failed.

The current system fixes that by:

- exposing a public, uncached `/api/version` route
- embedding the git short SHA into the build
- making both the VPS script and GitHub Actions poll for the expected SHA
- widening the GitHub Actions polling window
- tolerating transient startup `404` or empty responses as "not ready yet"

## Current VPS Script Behavior

`scripts/deploy-webhook.sh` now:

- records the previous commit and `.last-good-commit`
- fetches and resets to `origin/main`
- builds with `docker compose build --build-arg BUILD_SHA=<sha> app`
- recreates the app container with `docker compose up -d --remove-orphans`
- polls `/api/version` until the live `buildSha` matches
- writes `.last-good-commit` on success
- rolls back to the last good commit if container replacement fails or verification never reaches the expected SHA

## Runtime Container Changes

Production PDF rendering no longer launches Chromium through Puppeteer. It uses direct Chromium CLI rendering from `src/lib/pdf/puppeteer.ts`, with per-request temp directories and explicit runtime environment overrides:

- `HOME=/tmp`
- `XDG_CONFIG_HOME=/tmp/.chromium/config`
- `XDG_CACHE_HOME=/tmp/.chromium/cache`

The runner image now sets those env vars by default as well. This avoids the Chromium crashpad startup failure that was breaking invoice and quote PDF generation in production.

## Build Verification Endpoint

`src/app/api/version/route.ts` returns:

- `status`
- `buildSha`
- `buildTime`

It is:

- dynamic (`force-dynamic`)
- uncached (`Cache-Control: no-store, no-cache, must-revalidate`)
- excluded from auth middleware so it can be used by external health checks

## Site Changes Now Live

The following production changes are now part of `main` and deployed:

- temporary username/password reveal in the admin user management flow
- password reset returning a fresh one-time password to admins
- quote department edits no longer mutating the staff directory
- duplicate admin user creation guarded during submission
- Chromium CLI PDF generation for invoice, quote, and print quote flows
- SHA-based deploy verification and VPS rollback handling

## Recommended Operational Checks

Use these checks before assuming a deploy is healthy:

```bash
curl -fsS https://laportal.montalvo.io/api/version
gh run list --repo telenel/laportal --limit 5
ssh montalvo 'cd /opt/lapc-invoice-maker && docker compose ps'
ssh montalvo 'journalctl -u webhook -n 200 --no-pager'
```

What to verify:

- GitHub Actions for `main` finished `success`
- `/api/version` reports the expected `buildSha`
- the webhook log shows `Deploy complete`
- the app container was recreated recently

## Known Non-Blocking Follow-Up

GitHub Actions currently emits a Node 20 deprecation warning for `actions/checkout@v4` and `actions/setup-node@v4`. The deploy pipeline is working, but those action versions should be updated before GitHub's Node 20 removal window.
