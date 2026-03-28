# Domain Module Architecture — Decoupling Refactor

**Date:** 2026-03-27
**Goal:** Refactor the codebase from a two-layer architecture (route handlers + components) to a domain-module architecture with clear separation of concerns, better isolation, and minimal ripple effects from future changes.

---

## Problem Statement

The current codebase has structural coupling issues that make changes risky and unpredictable:

- **No data access layer:** All 27 API routes query Prisma directly, mixing query construction with auth, validation, and business logic in 100-200 line handlers.
- **Duplicated business logic:** Line item calculations appear in 4 routes. Formatting functions are redefined in route handlers despite existing in `lib/formatters.ts`. Auth session checks are copy-pasted across all 27 routes. Admin role checks use 3 different patterns.
- **Monolithic components:** `useInvoiceForm` (450 lines), `InvoiceDetailView` (400 lines), and `InvoiceManager` (580 lines) mix data fetching, business logic, and presentation.
- **Hardcoded API endpoints:** 9+ client components contain raw `fetch("/api/...")` calls with inline URL construction.
- **Duplicated type definitions:** `StaffMember` is defined 4 times across components. `Invoice` is defined 3 times with slight variations.
- **PDF generation coupled to routes:** Data transformation, Puppeteer lifecycle, and file I/O are embedded in route handlers.

### What Works Well (Preserve)

- UI components never touch Prisma directly — clean UI/data boundary.
- No circular dependencies — linear dependency flow.
- Prisma types don't leak to the UI layer (components define local interfaces).
- Prisma client singleton is properly implemented.
- Validators use Zod schemas in a dedicated file.

---

## Architecture: Domain Modules with Facade Pattern

### Directory Structure

```
src/domains/
├── invoice/
│   ├── types.ts          # InvoiceResponse, CreateInvoiceInput, InvoiceFilters, InvoiceStatus
│   ├── repository.ts     # All Prisma queries for invoices
│   ├── service.ts        # Business logic: calculations, status transitions, finalization
│   ├── api-client.ts     # Client-side typed fetch wrapper
│   ├── hooks.ts          # React hooks: useInvoices(), useInvoice(), useInvoiceStats()
│   └── constants.ts      # TAX_RATE, status values
│
├── quote/
│   ├── types.ts
│   ├── repository.ts
│   ├── service.ts        # Auto-expiry, quote numbering, conversion to invoice
│   ├── api-client.ts
│   ├── hooks.ts
│   └── constants.ts
│
├── staff/
│   ├── types.ts          # Single StaffMember + StaffSummary (replaces 4 duplicates)
│   ├── repository.ts
│   ├── service.ts        # Account number management, signer history
│   ├── api-client.ts
│   └── hooks.ts
│
├── admin/
│   ├── types.ts
│   ├── repository.ts     # User CRUD, account codes, db-health
│   └── service.ts        # Username generation, role management
│
├── analytics/
│   ├── types.ts
│   ├── repository.ts     # Aggregation queries (push grouping to DB)
│   └── service.ts
│
├── pdf/
│   ├── types.ts          # InvoicePDFData, QuotePDFData, IDPOverlayData
│   ├── service.ts        # Orchestrates generation + merge, owns Puppeteer lifecycle
│   └── storage.ts        # File I/O abstraction for PDF read/write/delete
│
└── shared/
    ├── types.ts          # PaginatedResponse, ApiError
    ├── auth.ts           # withAuth(), withAdmin() route wrappers
    ├── formatters.ts     # Consolidated formatCurrency, formatDate (single source)
    └── errors.ts         # Typed error classes, handleApiError(), consistent responses
```

### Dependency Rules

1. **Domains import from `shared/` and their own directory only** — with one exception: cross-domain `types.ts` imports (see rule 2).
2. **Cross-domain references go through types and services only.** A domain may import another domain's `types.ts` (for slim summary types like `StaffSummary`) and another domain's `service.ts` (for cross-domain orchestration). Never import another domain's repository, api-client, or hooks.
3. **Cross-domain data access goes through services, never repositories.** `invoiceService.finalize()` calls `pdfService.generateInvoice()` and `staffService.recordSignerHistory()` — never `pdfRepository` or `staffRepository` directly.
4. **Route handlers import from the domain service** — never from repository directly.
5. **Components import from domain `api-client.ts` and `hooks.ts`** — never use raw `fetch()`.

### Dependency Graph

```
shared/types, shared/auth, shared/formatters, shared/errors
    │
    ├── staff/types (StaffSummary exported for cross-domain use)
    │   staff/repository → staff/service
    │
    ├── invoice/types
    │   invoice/repository → invoice/service
    │     calls: pdfService, staffService
    │
    ├── quote/types
    │   quote/repository → quote/service
    │     calls: invoiceService, pdfService
    │
    ├── pdf/types
    │   pdf/storage → pdf/service
    │
    ├── admin/repository → admin/service
    │
    └── analytics/repository → analytics/service

Route handlers → withAuth() + domain service
Components → domain api-client → domain hooks → domain types (DTOs only)
```

---

## Layer Responsibilities

### Repository Layer

Pure Prisma wrappers. No business logic, no auth, no formatting.

- Returns domain types that mirror DB shape with relations.
- Never imports auth, formatters, or other domains' repositories.
- `$transaction` calls that are purely data (multi-table inserts) live here. Transactions mixing business decisions go in the service.
- One repository per domain, exporting a plain object of async methods.

### Service Layer

Orchestrates repositories, enforces business rules, owns calculations.

- Imports its own repository + other domains' services or types (never their repositories).
- Owns all validation beyond Zod schema parsing (status transitions, business constraints).
- Returns response DTOs, not raw Prisma objects — this is the serialization boundary where `Number(decimalField)` conversion happens.
- Pure functions (e.g., `calculateLineItems()`) extracted into sibling files for unit testing.

### API Client Layer

Client-side typed fetch wrappers. One per domain.

- Only file that knows endpoint URLs for its domain.
- Handles response parsing and error normalization via `ApiError`.
- Components never call `fetch()` directly.

### Hooks Layer

React hooks wrapping API client calls with `useState`/`useCallback`/`useEffect`.

- Returns `{ data, loading, error, refetch }` pattern.
- Intentionally simple — no external cache library. Caching can be added later inside hooks without touching components.
- Centralizes error handling via `shared/errors.ts`.

### Route Handlers

Thin dispatchers: parse request, check auth, call service, return response. Target: 10-15 lines per handler.

```typescript
export const POST = withAuth(async (req, session) => {
  const body = invoiceCreateSchema.parse(await req.json());
  const invoice = await invoiceService.create({ ...body, creatorId: session.user.id });
  return NextResponse.json(invoice, { status: 201 });
});
```

---

## Types Strategy

### Three Categories Per Domain

1. **Internal types** (repository <-> service): Mirror DB shape with relations. Only repository and service import these.
2. **DTOs** (cross the network boundary): What the API returns. Numbers are actual numbers. Dates are ISO strings. No Prisma artifacts.
3. **Shared enums/constants**: `InvoiceStatus`, `DocumentType`, `TAX_RATE`.

### Cross-Domain Type References

Slim summary types for cross-domain use:

```typescript
// staff/types.ts — exported for other domains
export interface StaffSummary {
  id: string;
  name: string;
  title: string;
  department: string;
}

// invoice/types.ts — imports the slim type
import type { StaffSummary } from "@/domains/staff/types";
export interface InvoiceResponse {
  staff: StaffSummary;
  // ...
}
```

Components only ever see DTOs. Internal types stay within the domain.

---

## Shared Auth Wrappers

Replace the 27x duplicated session check pattern:

```typescript
// shared/auth.ts
type AuthHandler = (req: NextRequest, session: Session) => Promise<NextResponse>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return handler(req, session);
  };
}

export function withAdmin(handler: AuthHandler) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return handler(req, session);
  };
}
```

---

## Shared Error Handling

Replace 4 inconsistent error patterns with one:

```typescript
// shared/errors.ts
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
  static async fromResponse(res: Response): Promise<ApiError> {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    return new ApiError(res.status, body.error ?? res.statusText);
  }
}

export function handleApiError(error: unknown, fallback = "Something went wrong") {
  const message = error instanceof ApiError ? error.message : fallback;
  toast.error(message);
  if (!(error instanceof ApiError)) console.error(error);
}
```

---

## Component Decomposition

### `useInvoiceForm` (450 lines -> 5 hooks + composition root)

```
src/components/invoice/
├── invoice-form.tsx                # Composition root (~80 lines) — wires hooks, renders layout
├── hooks/
│   ├── use-invoice-form-state.ts   # Form state only (useState/useReducer)
│   ├── use-tax-calculation.ts      # Derives subtotal/tax/total from items + TAX_RATE constant
│   ├── use-staff-autofill.ts       # Staff selection -> populates contact/signer fields
│   ├── use-staff-auto-save.ts      # Debounced PATCH via staffApi
│   └── use-invoice-save.ts         # saveDraft, finalize, savePendingCharge via invoiceApi
```

### `InvoiceDetailView` (400 lines -> container + 4 presenters)

```
src/components/invoices/
├── invoice-detail.tsx              # Container (~60 lines): useInvoice() hook, action handlers
├── invoice-detail-header.tsx       # Status badge, action toolbar, PDF/email buttons
├── invoice-detail-info.tsx         # Invoice metadata card
├── invoice-detail-staff.tsx        # Staff info card
└── invoice-detail-items.tsx        # Line items table (read-only)
```

### `InvoiceManager` (580 lines -> container + parts + hooks)

```
src/components/admin/
├── invoice-manager.tsx             # Container: orchestrates state
├── invoice-manager-table.tsx       # Table with editable cells
├── invoice-manager-filters.tsx     # Filter bar
├── hooks/
│   ├── use-invoice-manager.ts      # Filter + fetch + edit orchestration
│   └── use-inline-edit.ts          # Editable cell logic
```

Sub-components are pure presenters: receive DTOs as props, render, no side effects.

---

## Cross-Domain Operation Map

| Operation | Owner Service | Calls Into |
|-----------|--------------|-----------|
| Invoice finalization -> PDF | `invoiceService` | `pdfService.generateInvoice()` |
| Invoice finalization -> signer history | `invoiceService` | `staffService.recordSignerHistory()` |
| Invoice creation -> account number upsert | `invoiceService` | `staffService.upsertAccountNumber()` |
| Quote -> Invoice conversion | `quoteService` | `invoiceService.createFromQuote()` |
| Staff contact auto-save | `staffService` (from route) | own repository only |

---

## Migration Strategy

### Principle: Domain-by-Domain, Not Layer-by-Layer

Migrate one complete domain at a time. Don't create all repositories at once. The app stays working after each phase.

### Phase 1: Shared Foundations

Create `src/domains/shared/` — types, auth wrappers, consolidated formatters, error utilities. No existing routes change. Existing tests pass.

### Phase 2: Staff Domain (Proof of Concept)

Smallest domain, fewest cross-domain dependencies.

1. Create `domains/staff/types.ts` — single `StaffMember`, `StaffSummary`, `StaffWithRelations`.
2. Create `domains/staff/repository.ts` — extract queries from 3 staff routes.
3. Create `domains/staff/service.ts` — account number upsert, signer history.
4. Create `domains/staff/api-client.ts` — replace hardcoded `/api/staff` in 4 components.
5. Create `domains/staff/hooks.ts` — `useStaffList()`, `useStaffById()`.
6. Refactor staff routes to use `withAuth()` + `staffService`.
7. Update `StaffSelect`, `StaffForm`, `StaffTable` to use `staffApi` / hooks.
8. Delete the 4 duplicate `StaffMember` interfaces.

**Verification:** Staff CRUD works end-to-end.

### Phase 3: PDF Domain

Must happen before invoice migration since `invoiceService.finalize()` needs `pdfService`.

1. Create `domains/pdf/types.ts` — PDF data interfaces.
2. Create `domains/pdf/service.ts` — move generation/merge orchestration from routes.
3. Create `domains/pdf/storage.ts` — file I/O abstraction.
4. Move duplicated formatting functions from route handlers to `shared/formatters.ts`.
5. Update finalize/pdf routes to call `pdfService`.

**Verification:** Finalize invoice, generate quote PDF. Files written to same paths.

### Phase 4: Invoice Domain (Highest Value)

1. Create types, constants (`TAX_RATE`), repository, service.
2. `calculateLineItems()` becomes single source (replaces 4 duplicates).
3. `finalize()` orchestrates PDF + status transition + signer history.
4. Create api-client + hooks.
5. Refactor 5 invoice routes to thin dispatchers.
6. Update `InvoiceTable`, `InvoiceDetailView`, dashboard components.

**Verification:** Create, edit, finalize, delete invoices. Dashboard stats. CSV export.

### Phase 5: Quote Domain

1. Create domain files. `quoteService.convertToInvoice()` calls `invoiceService.createFromQuote()`.
2. Refactor 5 quote routes.
3. Update quote components.

**Verification:** Create quote, send, convert to invoice, delete.

### Phase 6: Admin + Analytics

1. Admin domain: user CRUD, account codes, db-health.
2. Analytics domain: push aggregations to DB-level queries.
3. Refactor remaining routes.

### Phase 7: Component Decomposition

1. Split `useInvoiceForm` -> 5 hooks.
2. Split `InvoiceDetailView` -> container + 4 presenters.
3. Split `InvoiceManager` -> container + table + filters + hooks.
4. Remove remaining duplicate types and dead code.

**Verification:** Full E2E walkthrough of invoice creation with keyboard mode.

---

## Migration Safety Rules

- **No big bang.** Each phase produces a working app. Merge after each phase.
- **Parallel old/new is OK.** During a phase, some routes may be old-style while others are migrated. Don't leave it half-done for more than one PR.
- **Tests follow the code.** When business logic moves from route to service, tests move too. Repositories get unit tests with mock Prisma. Services get integration tests.
- **Type imports are the canary.** If a component needs to import from `repository.ts`, or a route needs another domain's `repository.ts`, the boundary is wrong — stop and fix.

---

## Testing Strategy

| Layer | Test Type | What to Test |
|-------|-----------|-------------|
| Repository | Unit (mock Prisma) | Query construction, include clauses, filter mapping |
| Service | Unit + Integration | Business logic, calculations, status transitions, cross-domain orchestration |
| Pure functions (`calculateLineItems`, `parseSignatures`) | Unit | Input/output, edge cases (zero quantity, negative prices, missing fields) |
| API Client | Unit (mock fetch) | URL construction, error normalization, response parsing |
| Hooks | Unit (React Testing Library) | Loading/error/success states, refetch behavior |
| Route Handlers | Integration | Auth gating, validation rejection, service delegation |
| Presenters | Unit (React Testing Library) | Renders correct content for given props |

---

## What Doesn't Change

- `src/components/ui/` (shadcn/ui components) — untouched.
- `prisma/schema.prisma` — no schema changes.
- `src/lib/prisma.ts` — singleton stays, repositories import from it.
- `src/lib/auth.ts` — NextAuth config stays, `shared/auth.ts` wraps it.
- `src/lib/validators.ts` — Zod schemas stay, routes continue to use them.
- Keyboard mode, line items UI, quick picks UI — presentational components keep their current structure, just get cleaner props from hooks.
- `src/middleware.ts` — setup redirect logic unchanged.
