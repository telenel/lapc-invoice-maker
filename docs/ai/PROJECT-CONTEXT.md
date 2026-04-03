# LAPortal Project Context

## Repo Identity

- App: `LAPortal`
- Purpose: operations portal for Los Angeles Pierce College invoice and quote workflows
- Live URL: `https://laportal.montalvo.io`
- Repo: `telenel/laportal`
- Stack: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL, NextAuth, Vitest

## Core Structure

- `src/app/`
  App Router pages and route handlers
- `src/components/`
  UI components, including invoice, quote, analytics, dashboard, and shared UI
- `src/domains/`
  Domain-module architecture for invoice, quote, notification, staff, admin, analytics, pdf, event, chat, and related areas
- `prisma/schema.prisma`
  Database schema and canonical data model
- `tests/` and `src/__tests__/`
  Domain, component, and lib coverage

## Architecture Guardrails

- Route handlers call domain services, not repositories directly.
- Components use domain `api-client.ts` and `hooks.ts`, not raw `fetch()`.
- Repositories are Prisma-only data access layers with no business logic.
- Services own business rules, orchestration, calculations, and DTO serialization.
- Cross-domain usage goes through another domain's `service.ts` or shared types, never another domain's repository, api-client, or hooks.
- Keep line item descriptions in all caps everywhere.

## Operational Notes

- Deployment uses Docker Compose and Traefik on `montalvo.io`.
- The AI assistant uses Vercel AI SDK with Claude Haiku.
- Power Automate webhooks handle email integrations.
- FullCalendar powers operational calendar views.

## High-Value Files

- `prisma/schema.prisma`
  Data model and migration source
- `docs/PROJECT-OVERVIEW.md`
  Broader architecture reference
- `src/domains/`
  Core domain boundaries
- `src/lib/auth.ts`
  Auth helpers
- `src/lib/prisma.ts`
  Prisma client wiring

## Repo Memory Surfaces

- `AGENTS.md`
  Shared agent contract
- `CLAUDE.md`
  Claude entrypoint
- `docs/ai/PROJECT-CONTEXT.md`
  Durable project context
- `docs/ai/WORKFLOW.md`
  Durable workflow rules
- `docs/ai/SESSION-LOG.md`
  Running work log
