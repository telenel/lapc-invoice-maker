# LAPortal Project Overview

LAPortal is a Next.js operations portal for Los Angeles Pierce College. The repo currently spans invoice and quote operations, product catalog/Prism sync, textbook requisitions, print pricing, calendar/reminders, admin tooling, notifications, templates, archive flows, and platform health tooling.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 App Router |
| Runtime | Node 22 |
| Database | Supabase Postgres via Prisma 7 |
| Storage / Realtime | Supabase Storage + Realtime |
| Auth | NextAuth credentials + JWT sessions |
| UI | React 18 + Tailwind CSS 4 + base-ui/shadcn-style components |
| PDF | Puppeteer + pdf-lib |
| Testing | Vitest + React Testing Library |
| Deployment | Docker Compose + Traefik |
| CI/CD | GitHub Actions + exact-SHA VPS deploys |

## Current product surface

Top-level app surfaces in `src/app/` currently include:

- dashboard (`/`)
- invoices
- quotes, public quote review, and quote payment
- analytics
- calendar
- staff
- quick picks
- products, batch add, and bulk edit
- pricing calculator
- textbook requisitions and public submission
- archive
- admin users, settings, and pricing
- login/setup/account-request flows

The API surface is broad and currently includes routes for invoices, quotes, notifications, events, products, Prism sync, follow-ups, print pricing, templates, textbook requisitions, archive, realtime token minting, and protected internal platform/job endpoints.

## Codebase layout

```text
src/
  app/                 Next.js pages and route handlers
  components/          React UI components
  domains/             domain modules and typed client/server boundaries
  generated/           generated artifacts
  lib/                 shared runtime utilities
prisma/                schema, migrations, seed
scripts/               repo automation, deploy, audits, probes, imports
tests/                 Vitest suites
docs/                  durable docs, plans, and templates
hooks/                 tracked git hooks
.github/workflows/     CI, deploy, auto-merge, CodeRabbit helpers
```

## Domain modules

Current domain directories under `src/domains/`:

- `admin`
- `analytics`
- `archive`
- `bulk-edit`
- `calendar`
- `category`
- `chat`
- `contact`
- `dashboard`
- `event`
- `follow-up`
- `invoice`
- `notification`
- `pdf`
- `print-pricing`
- `product`
- `quick-picks`
- `quote`
- `saved-items`
- `shared`
- `staff`
- `template`
- `textbook-requisition`
- `upload`
- `user-draft`
- `user-preference`
- `user-quick-picks`

Not every domain has every layer. The common pattern is still:

```text
Route Handler -> auth wrapper -> domain service -> repository -> Prisma
Component -> domain api-client / hook -> route handler
```

But treat that as the preferred architecture, not a hard guarantee. The repo still contains some direct `fetch()` usage in components and other convenience code paths. If you are cleaning up architecture, reduce those call sites; do not document them as a best practice.

## Important domain areas

### Operations core

- `invoice` — invoice lifecycle, calculations, access rules, PDF generation hooks
- `quote` — quote lifecycle, public share/review, payment flow, follow-ups, duplication/revision
- `staff` — staff records, signer/account-code context
- `contact` — non-staff contacts tied to invoice/quote workflows
- `notification` — realtime notifications and read state
- `event` / `calendar` — calendar data, reminders, agenda tooling

### Product + retail tooling

- `product` — product catalog views, saved views, Prism sync helpers, validation, bulk-edit support, transaction sync
- `bulk-edit` — dry-run/commit transformation engine for product edits
- `print-pricing` — pricing config, quote generation, PDF output
- `template` — reusable template records

### Requisition + archival tooling

- `textbook-requisition` — requisition records, book rows, notifications, public submit flow
- `archive` — archive/restore flows for supported records

### User state + platform surfaces

- `user-draft` — persisted in-progress form state
- `user-preference` — dashboard/layout/user-level prefs
- `dashboard` — home-page aggregation and stats
- `chat` — AI assistant prompt/tooling
- `shared` — auth wrappers, cron helpers, shared types/errors/formatters

## Data model overview

Key Prisma models currently include:

- user/auth models: `User`, `UserPreference`, `UserDraft`
- staff/contact models: `Staff`, `StaffAccountNumber`, `StaffSignerHistory`, `Contact`
- invoice/quote models: `Invoice`, `InvoiceItem`, `QuoteView`, `FollowUp`, `SavedLineItem`, `QuickPickItem`, `UserQuickPick`, `Category`
- calendar/notification models: `Event`, `Notification`, `JobRun`, `RateLimitEvent`
- product/retail models: `SavedSearch`, `BulkEditRun`, `SyncRun`, `SalesTransaction`, `SalesTransactionsSyncState`
- print pricing models: `PrintPricingConfig`, `PrintPricingTier`, `PrintQuote`, `PrintQuoteLineItem`
- requisition models: `TextbookRequisition`, `RequisitionBook`, `RequisitionNotification`
- template/settings models: `Template`, `TemplateItem`, `AppSetting`

Use `prisma/schema.prisma` as the source of truth when changing data behavior.

## Shared runtime behavior

### Auth

- NextAuth credentials auth remains the session authority.
- Roles are `admin` and `user`.
- Route protection is centralized through shared auth wrappers.
- Supabase is used for infrastructure, not primary session ownership.

### Storage + realtime

- PDFs/uploads are stored through Supabase Storage paths.
- browser realtime is bridged through the app with `GET /api/realtime/token`
- legacy filesystem compatibility exists only as an explicit fallback path and should stay off unless an audit proves it is needed

### Scheduling

The app supports two scheduler modes:

- `JOB_SCHEDULER=app` — in-process cron registration
- `JOB_SCHEDULER=supabase` — protected internal job routes triggered by Supabase `pg_cron`

Current scheduler tooling expects three Supabase jobs:

- `laportal-event-reminders`
- `laportal-payment-follow-ups`
- `laportal-account-follow-ups`

Scheduler inspection/reconciliation lives behind `GET/POST /api/internal/platform/supabase-scheduler` and `src/lib/supabase-scheduler.ts`.

### Versioning + diagnostics

- runtime build identity is exposed via `/api/version`
- build metadata comes from immutable image/container env (`BUILD_SHA`, `BUILD_TIME`) with `.build-meta.json` as a startup-written fallback
- admin/platform diagnostics include scheduler mode, storage-audit state, and recent tracked job runs

## Repo automation

### Validation

- `npm run ship-check` = lint + test + build + stamp `HEAD`
- `ship-check` requires a completely clean tree, including no untracked files
- feature-branch pushes are guarded by `hooks/pre-push`

### Branch workflow

- `npm run git:start-branch -- <branch>` starts new work from fresh `main`
- `npm run git:resume-branch -- <branch>` safely re-syncs an existing remote branch
- `npm run git:publish-pr` pushes the branch and opens a PR with `gh`
- once a PR exists, use `CR_FIX=1 git push` only for review fixes

### CI / deploy

GitHub Actions currently provides:

- `ci.yml` — `actionlint`, `migration-check`, `ship-check`
- `enable-automerge.yml` — enables GitHub native auto-merge for qualifying PRs when `AUTOMERGE_PAT` exists
- `deploy.yml` — waits for successful CI on the exact `main` SHA, deploys that SHA, then verifies `/api/version`
- `coderabbit-finishing-touches.yml` — optional label-driven CodeRabbit helper comments

The VPS deploy engine is `scripts/deploy-webhook.sh`:

1. fetch target ref
2. verify expected SHA when provided
3. reset repo to target commit
4. skip only if the live app already serves that SHA and smoke checks pass
5. otherwise build the candidate image
6. run migration preflight in the candidate image: `prisma migrate deploy` + `node scripts/check-products-derived-view.mjs`
7. swap containers only after preflight succeeds
8. verify `/api/version`
9. run route smoke checks
10. roll back on post-swap failure

## Files worth reading before large changes

- `README.md`
- `docs/GIT-WORKFLOW.md`
- `docs/SUPABASE-MIGRATION-STATUS.md`
- `prisma/schema.prisma`
- `scripts/deploy-webhook.sh`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
