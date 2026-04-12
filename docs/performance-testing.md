# Performance Testing

LA Portal can run Lighthouse audits through Playwright so we can measure public and authenticated routes using the same browser automation stack as the E2E suite.

## Install

```bash
npm install
```

## First-time local setup

If your local database has not been initialized yet, run:

```bash
npx prisma migrate deploy
npx prisma db seed
```

When `E2E_USERNAME` and `E2E_PASSWORD` are present in `.env.local`, the seed step also creates or updates a local admin user for authenticated audits.

## Public route audit

```bash
npm run audit:perf -- --path /
```

## All Lighthouse categories

```bash
npm run audit:perf:all -- --path /
```

This runs:

- `performance`
- `accessibility`
- `best-practices`

## Authenticated route audit

Store credentials in a local `.env.local` file or export them in your shell:

```bash
E2E_USERNAME=your-user
E2E_PASSWORD=your-password
```

Then run:

```bash
npm run audit:perf -- --path /analytics --auth
```

## DevTools audit

```bash
npm run audit:perf:headed -- --path /admin/users --auth
```

## Median of repeated runs

```bash
npm run audit:perf:median -- --path / --auth
```

You can also choose your own run count:

```bash
npm run audit:perf -- --path / --auth --runs 5
```

## Batch route sets

List the available route sets:

```bash
npm run audit:perf -- --list-route-sets
```

Run the default baseline batch:

```bash
npm run audit:perf:batch
```

This command now evaluates route thresholds and exits non-zero when a route regresses.

If you want the batch reports without failing the command, run:

```bash
npm run audit:perf:batch:report
```

Run a specific route set:

```bash
npm run audit:perf -- --route-set admin-heavy --all-categories --runs 3
```

To ignore threshold failures for a custom run:

```bash
npm run audit:perf -- --route-set admin-heavy --all-categories --runs 3 --ignore-thresholds
```

The default manifest lives at `scripts/lighthouse-routes.json`.

## Notes

- For local audits, the script reuses an existing app server on `LIGHTHOUSE_BASE_URL` and otherwise starts `npm run dev` automatically.
- Reports are written to `playwright-report/lighthouse/`.
- Repeated runs save per-run HTML/JSON reports plus a `.summary.json` and `.summary.txt` median summary file.
- Batch runs save one folder per route plus a top-level batch summary file for the whole route set.
- Batch runs evaluate any route thresholds in the manifest and fail the command when thresholds are missed, unless `--ignore-thresholds` is used.
- The default browser is installed Google Chrome. Use `--browser chromium` to use Playwright's Chromium build instead.
- Installed Chrome is currently the more reliable choice for authenticated dashboard audits on this machine.
- The default mode is headless. Use `audit:perf:headed` to inspect the run in a visible browser with DevTools.
- Public routes do not need credentials. Protected routes do.
- Repeated authenticated local audits can hit LA Portal's login rate limiter and return `401`. If that happens in local dev, clear the local rows with `psql "$DATABASE_URL" -c "delete from rate_limit_events where scope='login';"` and rerun.
