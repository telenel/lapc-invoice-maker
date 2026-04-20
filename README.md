# LAPortal

Operations portal for **Los Angeles Pierce College**. LAPortal now covers the final eight-phase product set: invoice and quote workflows, the product catalog and bulk-edit workspace, staff and calendar operations, textbook requisitions, admin tooling, analytics, archive, pricing, notifications, background jobs, PDFs, and the Prism-backed item editor parity work.

**Live:** [laportal.montalvo.io](https://laportal.montalvo.io)

## What It Does

- Invoice creation and finalization with keyboard-first entry, requestor autofill, account-number follow-up, PDF generation, and approver history
- Quote creation, sharing, public approve/decline flows, payment-detail capture, conversion to invoice, and follow-up reminders
- Product catalog browsing, batch add, and bulk-edit commit flows with Prism fallback data for offline development
- Staff directory, calendar, AI assistant, archive, analytics, admin settings, and admin pricing
- Supabase-backed storage, realtime notifications, database-backed rate limiting, and job-run visibility

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 App Router |
| Database | Prisma 7 on Supabase Postgres |
| Storage / Realtime | Supabase Storage and Supabase Realtime |
| Auth | NextAuth credentials + JWT sessions |
| PDF | Puppeteer and pdf-lib |
| Styling | Tailwind CSS 4 and shadcn/ui v4 |
| AI | Anthropic Claude via the AI SDK |
| Testing | Vitest and React Testing Library |
| Deployment | Docker Compose, Traefik, GitHub Actions, exact-SHA VPS deploys |

## Working Model

- GitHub is the source of truth. Local branches are disposable caches.
- One branch has one active writer at a time across machines and agents.
- Run `npm run ship-check` before push or PR creation.
- Use `npm run git:start-branch -- feat/name` for fresh work and `npm run git:resume-branch -- feat/name` to re-sync a remote branch.
- After a PR exists, only push review fixes with `CR_FIX=1 git push`.

## Common Commands

```bash
npm install
npm run git:bootstrap
npm run dev
npm test
npm run ship-check
npx prisma generate
npx prisma migrate dev --name <name>
npx prisma migrate deploy
npm run hotfix:preflight
npm run hotfix:deploy -- <ref>
```

## Environment

```env
DATABASE_URL=postgresql://user:pass@host:5432/postgres
DIRECT_URL=postgresql://user:pass@host:5432/postgres
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>
JOB_SCHEDULER=app
SUPABASE_SCHEDULER_CONFIRMED=false
CRON_SECRET=<cron-secret-for-internal-job-routes>
ALLOW_LEGACY_FILESYSTEM_FALLBACK=false
```

Important: the public Supabase variables must be present at image build time, not only at container runtime.

## Deployment Notes

- Production deploys are exact-SHA and verify `/api/version` after restart.
- The live image writes its own build metadata, and the app also uses immutable runtime metadata when present.
- `JOB_SCHEDULER=supabase` only becomes active after the scheduler is explicitly confirmed.
- Legacy document storage should remain off unless the audit tooling proves compatibility reads are still needed.

## Documentation Map

- [docs/README.md](docs/README.md) - canonical documentation index
- [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) - architecture, routes, flows, and integrations
- [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) - multi-machine branching rules
- [docs/HOTFIX-WORKFLOW.md](docs/HOTFIX-WORKFLOW.md) - fast SSH deploy lane
- [docs/DEPLOYMENT-STANDARD.md](docs/DEPLOYMENT-STANDARD.md) - exact-SHA deploy contract
- [docs/SUPABASE-MIGRATION-STATUS.md](docs/SUPABASE-MIGRATION-STATUS.md) - current Supabase/platform status
- [docs/PRINT-SHOP-PRICING.md](docs/PRINT-SHOP-PRICING.md) - pricing system notes
- [docs/performance-testing.md](docs/performance-testing.md) - Lighthouse and route audit workflow
- [docs/ai/PROJECT-CONTEXT.md](docs/ai/PROJECT-CONTEXT.md) - durable agent context
- [docs/ai/WORKFLOW.md](docs/ai/WORKFLOW.md) - agent workflow rules
- [docs/ai/SUPABASE-HANDOFF.md](docs/ai/SUPABASE-HANDOFF.md) - Claude-facing Supabase handoff

## License

Private project for Los Angeles Pierce College.
