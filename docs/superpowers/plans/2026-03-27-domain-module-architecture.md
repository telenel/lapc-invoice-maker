# Domain Module Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor from a two-layer architecture (route handlers + components) into isolated domain modules with repository, service, api-client, and hooks layers.

**Architecture:** Each domain (staff, invoice, quote, pdf, admin, analytics) gets its own directory under `src/domains/` with types, repository, service, api-client, and hooks files. A shared domain provides auth wrappers, error utilities, and formatters. Routes become thin dispatchers. Components consume typed api-clients and hooks instead of raw `fetch()`.

**Tech Stack:** Next.js 14 (App Router), Prisma 7 (`@/generated/prisma/client`), TypeScript, Vitest, Zod, Puppeteer, pdf-lib

**Spec:** `docs/superpowers/specs/2026-03-27-domain-module-architecture-design.md`

---

## File Structure Overview

### New Files (Phase 1-7)

```
src/domains/
├── shared/
│   ├── types.ts              # PaginatedResponse, ApiError, AuthHandler
│   ├── auth.ts               # withAuth(), withAdmin() route wrappers
│   ├── formatters.ts         # Consolidated formatting (moved from src/lib/formatters.ts)
│   └── errors.ts             # handleApiError(), error normalization
├── staff/
│   ├── types.ts              # StaffMember, StaffSummary, StaffWithRelations, DTOs
│   ├── repository.ts         # Prisma queries for staff, account numbers, signer history
│   ├── service.ts            # Staff business logic, account upsert, signer recording
│   ├── api-client.ts         # Client-side fetch wrapper for /api/staff/*
│   └── hooks.ts              # useStaffList(), useStaff()
├── pdf/
│   ├── types.ts              # CoverSheetData, IDPOverlayData, QuotePDFData
│   ├── service.ts            # PDF orchestration (generate, merge, stream)
│   └── storage.ts            # File read/write/delete abstraction
├── invoice/
│   ├── types.ts              # InvoiceResponse, CreateInvoiceInput, InvoiceFilters
│   ├── constants.ts          # TAX_RATE, InvoiceStatus
│   ├── calculations.ts       # calculateLineItems(), calculateTotal()
│   ├── repository.ts         # Prisma queries for invoices
│   ├── service.ts            # Invoice business logic, finalization
│   ├── api-client.ts         # Client-side fetch wrapper
│   └── hooks.ts              # useInvoices(), useInvoice(), useInvoiceStats()
├── quote/
│   ├── types.ts              # QuoteResponse, CreateQuoteInput, QuoteFilters
│   ├── repository.ts         # Prisma queries for quotes
│   ├── service.ts            # Quote logic, auto-expiry, conversion
│   ├── api-client.ts         # Client-side fetch wrapper
│   └── hooks.ts              # useQuotes(), useQuote()
├── admin/
│   ├── types.ts              # UserResponse, AccountCodeResponse
│   ├── repository.ts         # User CRUD, account codes, db-health
│   └── service.ts            # Username generation, role management
└── analytics/
    ├── types.ts              # AnalyticsResponse, aggregation types
    ├── repository.ts         # DB-level aggregation queries
    └── service.ts            # Analytics orchestration

tests/domains/
├── shared/
│   ├── auth.test.ts
│   └── formatters.test.ts
├── staff/
│   ├── repository.test.ts
│   └── service.test.ts
├── invoice/
│   ├── calculations.test.ts
│   ├── repository.test.ts
│   └── service.test.ts
├── pdf/
│   ├── service.test.ts
│   └── storage.test.ts
└── quote/
    ├── repository.test.ts
    └── service.test.ts

src/components/invoice/hooks/
├── use-invoice-form-state.ts
├── use-tax-calculation.ts
├── use-staff-autofill.ts
├── use-staff-auto-save.ts
└── use-invoice-save.ts

src/components/invoices/
├── invoice-detail-header.tsx
├── invoice-detail-info.tsx
├── invoice-detail-staff.tsx
└── invoice-detail-items.tsx

src/components/admin/hooks/
├── use-invoice-manager.ts
└── use-inline-edit.ts
src/components/admin/
├── invoice-manager-table.tsx
└── invoice-manager-filters.tsx
```

### Modified Files

```
src/app/api/staff/route.ts                           # Phase 2: thin dispatcher
src/app/api/staff/[id]/route.ts                       # Phase 2: thin dispatcher
src/app/api/staff/[id]/account-numbers/route.ts       # Phase 2: thin dispatcher
src/components/invoice/staff-select.tsx                # Phase 2: use staffApi
src/components/staff/staff-form.tsx                    # Phase 2: use staffApi, shared types
src/components/staff/staff-table.tsx                   # Phase 2: use staffApi, shared types
src/app/api/invoices/[id]/finalize/route.ts           # Phase 3+4: use pdfService + invoiceService
src/app/api/invoices/[id]/pdf/route.ts                # Phase 3: use pdfStorage
src/app/api/quotes/[id]/pdf/route.ts                  # Phase 3: use pdfService
src/app/api/invoices/route.ts                         # Phase 4: thin dispatcher
src/app/api/invoices/[id]/route.ts                    # Phase 4: thin dispatcher
src/app/api/invoices/export/route.ts                  # Phase 4: thin dispatcher
src/app/api/quotes/route.ts                           # Phase 5: thin dispatcher
src/app/api/quotes/[id]/route.ts                      # Phase 5: thin dispatcher
src/app/api/quotes/[id]/send/route.ts                 # Phase 5: thin dispatcher
src/app/api/quotes/[id]/convert/route.ts              # Phase 5: thin dispatcher
src/app/api/admin/users/route.ts                      # Phase 6: thin dispatcher
src/app/api/admin/users/[id]/route.ts                 # Phase 6: thin dispatcher
src/app/api/admin/account-codes/route.ts              # Phase 6: thin dispatcher
src/app/api/admin/account-codes/[id]/route.ts         # Phase 6: thin dispatcher
src/app/api/admin/db-health/route.ts                  # Phase 6: thin dispatcher
src/app/api/analytics/route.ts                        # Phase 6: thin dispatcher
src/components/invoice/invoice-form.tsx                # Phase 7: decompose into hooks
src/components/invoices/invoice-detail.tsx             # Phase 7: decompose into presenters
src/components/admin/invoice-manager.tsx               # Phase 7: decompose into parts
src/components/invoices/invoice-table.tsx              # Phase 4: use invoiceApi
src/components/dashboard/stats-cards.tsx               # Phase 4: use invoiceApi hooks
src/components/dashboard/recent-invoices.tsx           # Phase 4: use invoiceApi hooks
src/components/dashboard/pending-charges.tsx           # Phase 4: use invoiceApi hooks
src/app/invoices/page.tsx                             # Phase 4: use invoiceService
src/app/quotes/page.tsx                               # Phase 5: use quoteService
```

---

## Phase 1: Shared Foundations

### Task 1: Shared Types

**Files:**
- Create: `src/domains/shared/types.ts`

- [ ] **Step 1: Create shared types file**

```typescript
// src/domains/shared/types.ts
import { type NextRequest, NextResponse } from "next/server";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    return new ApiError(res.status, body.error ?? res.statusText);
  }
}

export type AuthSession = {
  user: {
    id: string;
    name: string;
    username: string;
    role: string;
    setupComplete: boolean;
  };
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `src/domains/shared/types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/domains/shared/types.ts
git commit -m "feat: add shared domain types (PaginatedResponse, ApiError, AuthSession)"
```

---

### Task 2: Shared Auth Wrappers

**Files:**
- Create: `src/domains/shared/auth.ts`
- Create: `tests/domains/shared/auth.test.ts`

- [ ] **Step 1: Write failing test for withAuth**

```typescript
// tests/domains/shared/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next-auth before importing module under test
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";
import { withAuth, withAdmin } from "@/domains/shared/auth";
import { NextResponse } from "next/server";

const mockGetServerSession = vi.mocked(getServerSession);

function makeRequest(url = "http://localhost/api/test") {
  return new NextRequest(url);
}

describe("withAuth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with session when authenticated", async () => {
    const session = { user: { id: "u1", name: "Test", role: "user" } };
    mockGetServerSession.mockResolvedValue(session);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const req = makeRequest();
    await wrapped(req);
    expect(handler).toHaveBeenCalledWith(req, session);
  });
});

describe("withAdmin", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withAdmin(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when not admin", async () => {
    const session = { user: { id: "u1", name: "Test", role: "user" } };
    mockGetServerSession.mockResolvedValue(session);
    const handler = vi.fn();
    const wrapped = withAdmin(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when admin", async () => {
    const session = { user: { id: "u1", name: "Test", role: "admin" } };
    mockGetServerSession.mockResolvedValue(session);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAdmin(handler);
    const req = makeRequest();
    await wrapped(req);
    expect(handler).toHaveBeenCalledWith(req, session);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domains/shared/auth.test.ts 2>&1 | tail -20`
Expected: FAIL — module `@/domains/shared/auth` not found

- [ ] **Step 3: Implement withAuth and withAdmin**

```typescript
// src/domains/shared/auth.ts
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type AuthHandler = (
  req: NextRequest,
  session: { user: { id: string; name: string; username: string; role: string; setupComplete: boolean } }
) => Promise<NextResponse>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, session as Parameters<AuthHandler>[1] extends infer S ? { user: S extends { user: infer U } ? U : never } : never);
  };
}

export function withAdmin(handler: AuthHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as { role: string };
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, session as Parameters<AuthHandler>[1] extends infer S ? { user: S extends { user: infer U } ? U : never } : never);
  };
}
```

Wait — the session typing is awkward. Let me simplify using the AuthSession type:

```typescript
// src/domains/shared/auth.ts
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { AuthSession } from "./types";

type AuthHandler = (req: NextRequest, session: AuthSession) => Promise<NextResponse>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, session as unknown as AuthSession);
  };
}

export function withAdmin(handler: AuthHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (session.user as unknown as { role: string }).role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, session as unknown as AuthSession);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domains/shared/auth.test.ts 2>&1 | tail -20`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/shared/auth.ts tests/domains/shared/auth.test.ts
git commit -m "feat: add withAuth/withAdmin route wrappers with tests"
```

---

### Task 3: Shared Error Handling

**Files:**
- Create: `src/domains/shared/errors.ts`

- [ ] **Step 1: Create error utilities**

```typescript
// src/domains/shared/errors.ts
import { toast } from "sonner";
import { ApiError } from "./types";

export function handleApiError(error: unknown, fallback = "Something went wrong") {
  const message = error instanceof ApiError ? error.message : fallback;
  toast.error(message);
  if (!(error instanceof ApiError)) {
    console.error(error);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/shared/errors.ts
git commit -m "feat: add shared error handling utility"
```

---

### Task 4: Consolidate Formatters

**Files:**
- Create: `src/domains/shared/formatters.ts`
- Create: `tests/domains/shared/formatters.test.ts`
- Modify: `src/lib/formatters.ts` (re-export from new location)

- [ ] **Step 1: Write failing tests for consolidated formatters**

```typescript
// tests/domains/shared/formatters.test.ts
import { describe, it, expect } from "vitest";
import {
  formatAmount,
  formatCurrency,
  formatDate,
  formatDateLong,
  formatDateCompact,
  getInitials,
} from "@/domains/shared/formatters";

describe("formatAmount", () => {
  it("formats number to dollar string with commas", () => {
    expect(formatAmount(1234.5)).toBe("$1,234.50");
  });

  it("handles string input (Prisma Decimal)", () => {
    expect(formatAmount("999.9")).toBe("$999.90");
  });

  it("handles zero", () => {
    expect(formatAmount(0)).toBe("$0.00");
  });
});

describe("formatCurrency", () => {
  it("formats number to $X.XX without commas", () => {
    expect(formatCurrency(1234.5)).toBe("$1234.50");
  });

  it("handles string input", () => {
    expect(formatCurrency("50")).toBe("$50.00");
  });
});

describe("formatDate", () => {
  it("formats ISO date to short format", () => {
    expect(formatDate("2026-03-15")).toBe("Mar 15, 2026");
  });
});

describe("formatDateLong", () => {
  it("formats ISO date to long format", () => {
    expect(formatDateLong("2026-03-15")).toBe("March 15, 2026");
  });
});

describe("formatDateCompact", () => {
  it("formats ISO date to compact format", () => {
    expect(formatDateCompact("2026-03-15")).toBe("Mar 15");
  });
});

describe("getInitials", () => {
  it("extracts initials from full name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("limits to 2 characters", () => {
    expect(getInitials("John Michael Doe")).toBe("JM");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domains/shared/formatters.test.ts 2>&1 | tail -20`
Expected: FAIL — module `@/domains/shared/formatters` not found

- [ ] **Step 3: Create consolidated formatters**

```typescript
// src/domains/shared/formatters.ts

/** Dollar format with commas for display: "$1,234.50" */
export function formatAmount(amount: string | number): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Dollar format without commas for PDFs: "$1234.50" */
export function formatCurrency(value: string | number): string {
  return `$${Number(value).toFixed(2)}`;
}

/** "Mar 15, 2026" */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "March 15, 2026" */
export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Mar 15" */
export function formatDateCompact(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "JD" from "John Doe" */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** "March 15, 2026" from Date object (for PDF templates) */
export function formatDateFromDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domains/shared/formatters.test.ts 2>&1 | tail -20`
Expected: All 9 tests PASS

- [ ] **Step 5: Update old formatters to re-export**

Replace the contents of `src/lib/formatters.ts` with re-exports so existing imports don't break:

```typescript
// src/lib/formatters.ts
// Re-export from canonical location for backward compatibility
export {
  formatAmount,
  formatDate,
  formatDateLong,
  formatDateCompact,
  getInitials,
} from "@/domains/shared/formatters";
```

- [ ] **Step 6: Verify existing tests still pass**

Run: `npx vitest run 2>&1 | tail -20`
Expected: All existing tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/domains/shared/formatters.ts tests/domains/shared/formatters.test.ts src/lib/formatters.ts
git commit -m "feat: consolidate formatters into shared domain, re-export from lib for compat"
```

---

## Phase 2: Staff Domain

### Task 5: Staff Types

**Files:**
- Create: `src/domains/staff/types.ts`

- [ ] **Step 1: Create staff domain types**

```typescript
// src/domains/staff/types.ts

// ── Cross-domain (exported for invoice, quote domains) ──
export interface StaffSummary {
  id: string;
  name: string;
  title: string;
  department: string;
}

// ── Internal (repository <-> service) ──
export interface StaffAccountNumberRow {
  id: string;
  staffId: string;
  accountCode: string;
  description: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface SignerHistoryRow {
  id: string;
  staffId: string;
  position: number;
  signer: {
    id: string;
    name: string;
    title: string;
  };
}

export interface StaffWithRelations {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  accountNumbers: StaffAccountNumberRow[];
  signerHistories: SignerHistoryRow[];
}

// ── DTOs (cross network boundary) ──
export interface StaffResponse {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
  active: boolean;
}

export interface StaffDetailResponse extends StaffResponse {
  accountNumbers: AccountNumberResponse[];
  signerHistories: SignerHistoryResponse[];
}

export interface AccountNumberResponse {
  id: string;
  accountCode: string;
  description: string;
  lastUsedAt: string | null;
}

export interface SignerHistoryResponse {
  position: number;
  signer: StaffSummary;
}

// ── Input types ──
export interface StaffFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  paginated?: boolean;
}

export interface CreateStaffInput {
  name: string;
  title: string;
  department: string;
  accountCode?: string;
  extension?: string;
  email?: string;
  phone?: string;
  approvalChain?: string[];
}

export interface UpdateStaffInput extends Partial<CreateStaffInput> {}

export interface UpsertAccountNumberInput {
  staffId: string;
  accountCode: string;
  description?: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/staff/types.ts
git commit -m "feat: add staff domain types"
```

---

### Task 6: Staff Repository

**Files:**
- Create: `src/domains/staff/repository.ts`
- Create: `tests/domains/staff/repository.test.ts`

- [ ] **Step 1: Write failing tests for staff repository**

```typescript
// tests/domains/staff/repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    staff: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    staffAccountNumber: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    staffSignerHistory: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { staffRepository } from "@/domains/staff/repository";

const mockPrisma = vi.mocked(prisma, true);

describe("staffRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findMany", () => {
    it("returns all active staff when no filters", async () => {
      const staffList = [{ id: "s1", name: "Alice", active: true }];
      mockPrisma.staff.findMany.mockResolvedValue(staffList as never);

      const result = await staffRepository.findMany({});

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ active: true }),
          orderBy: { name: "asc" },
        })
      );
      expect(result).toEqual(staffList);
    });

    it("applies search filter across name, department, title, email", async () => {
      mockPrisma.staff.findMany.mockResolvedValue([]);

      await staffRepository.findMany({ search: "alice" });

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true,
            OR: [
              { name: { contains: "alice", mode: "insensitive" } },
              { department: { contains: "alice", mode: "insensitive" } },
              { title: { contains: "alice", mode: "insensitive" } },
              { email: { contains: "alice", mode: "insensitive" } },
            ],
          }),
        })
      );
    });

    it("paginates when page and pageSize provided", async () => {
      mockPrisma.staff.findMany.mockResolvedValue([]);
      mockPrisma.staff.count.mockResolvedValue(50);

      const result = await staffRepository.findManyPaginated({
        search: "",
        page: 2,
        pageSize: 10,
      });

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.total).toBe(50);
    });
  });

  describe("findById", () => {
    it("returns staff with relations", async () => {
      const staff = { id: "s1", name: "Alice", accountNumbers: [], signerHistories: [] };
      mockPrisma.staff.findUnique.mockResolvedValue(staff as never);

      const result = await staffRepository.findById("s1");

      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { id: "s1" },
        include: {
          accountNumbers: true,
          signerHistories: { include: { signer: true } },
        },
      });
      expect(result).toEqual(staff);
    });
  });

  describe("upsertAccountNumber", () => {
    it("upserts with composite key", async () => {
      const acct = { id: "a1", staffId: "s1", accountCode: "1234" };
      mockPrisma.staffAccountNumber.upsert.mockResolvedValue(acct as never);

      await staffRepository.upsertAccountNumber({
        staffId: "s1",
        accountCode: "1234",
        description: "Main",
      });

      expect(mockPrisma.staffAccountNumber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { staffId_accountCode: { staffId: "s1", accountCode: "1234" } },
          update: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
          create: expect.objectContaining({ staffId: "s1", accountCode: "1234" }),
        })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domains/staff/repository.test.ts 2>&1 | tail -20`
Expected: FAIL — module `@/domains/staff/repository` not found

- [ ] **Step 3: Implement staff repository**

```typescript
// src/domains/staff/repository.ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  StaffFilters,
  StaffWithRelations,
  CreateStaffInput,
  UpdateStaffInput,
  UpsertAccountNumberInput,
} from "./types";

function buildWhere(filters: StaffFilters): Prisma.StaffWhereInput {
  const where: Prisma.StaffWhereInput = { active: true };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { department: { contains: filters.search, mode: "insensitive" } },
      { title: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

const includeRelations = {
  accountNumbers: true,
  signerHistories: { include: { signer: true } },
} as const;

export const staffRepository = {
  async findMany(filters: StaffFilters) {
    return prisma.staff.findMany({
      where: buildWhere(filters),
      include: { accountNumbers: true },
      orderBy: { name: "asc" as const },
    });
  },

  async findManyPaginated(filters: StaffFilters & { page: number; pageSize: number }) {
    const where = buildWhere(filters);
    const [data, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        include: { accountNumbers: true },
        orderBy: { name: "asc" as const },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.staff.count({ where }),
    ]);
    return { data, total };
  },

  async findById(id: string) {
    return prisma.staff.findUnique({
      where: { id },
      include: includeRelations,
    });
  },

  async create(data: CreateStaffInput) {
    return prisma.staff.create({
      data: {
        name: data.name,
        title: data.title,
        department: data.department,
        accountCode: data.accountCode ?? "",
        extension: data.extension ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        approvalChain: data.approvalChain ?? [],
      },
      include: { accountNumbers: true },
    });
  },

  async update(id: string, data: UpdateStaffInput) {
    return prisma.staff.update({
      where: { id },
      data,
      include: includeRelations,
    });
  },

  async partialUpdate(id: string, data: UpdateStaffInput) {
    return prisma.staff.update({
      where: { id },
      data,
      include: includeRelations,
    });
  },

  async softDelete(id: string) {
    return prisma.staff.update({
      where: { id },
      data: { active: false },
    });
  },

  async findAccountNumbers(staffId: string) {
    return prisma.staffAccountNumber.findMany({
      where: { staffId },
      orderBy: { lastUsedAt: "desc" },
    });
  },

  async upsertAccountNumber(input: UpsertAccountNumberInput) {
    return prisma.staffAccountNumber.upsert({
      where: {
        staffId_accountCode: {
          staffId: input.staffId,
          accountCode: input.accountCode,
        },
      },
      update: {
        description: input.description ?? "",
        lastUsedAt: new Date(),
      },
      create: {
        staffId: input.staffId,
        accountCode: input.accountCode,
        description: input.description ?? "",
      },
    });
  },

  async upsertSignerHistory(invoiceId: string, staffId: string, position: number, signerId: string) {
    return prisma.staffSignerHistory.upsert({
      where: {
        staffId_position: { staffId, position },
      },
      update: { signerId },
      create: { staffId, position, signerId, invoiceId },
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domains/staff/repository.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/staff/repository.ts tests/domains/staff/repository.test.ts
git commit -m "feat: add staff repository with Prisma queries and tests"
```

---

### Task 7: Staff Service

**Files:**
- Create: `src/domains/staff/service.ts`
- Create: `tests/domains/staff/service.test.ts`

- [ ] **Step 1: Write failing test for staff service**

```typescript
// tests/domains/staff/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/staff/repository", () => ({
  staffRepository: {
    findMany: vi.fn(),
    findManyPaginated: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    partialUpdate: vi.fn(),
    softDelete: vi.fn(),
    findAccountNumbers: vi.fn(),
    upsertAccountNumber: vi.fn(),
    upsertSignerHistory: vi.fn(),
  },
}));

import { staffRepository } from "@/domains/staff/repository";
import { staffService } from "@/domains/staff/service";

const mockRepo = vi.mocked(staffRepository, true);

describe("staffService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("list", () => {
    it("returns flat array when not paginated", async () => {
      const staffList = [
        { id: "s1", name: "Alice", title: "Manager", department: "IT", accountCode: "", extension: "", email: "", phone: "", approvalChain: [], active: true, accountNumbers: [] },
      ];
      mockRepo.findMany.mockResolvedValue(staffList as never);

      const result = await staffService.list({ search: "alice" });

      expect(mockRepo.findMany).toHaveBeenCalledWith({ search: "alice" });
      expect(result).toEqual([
        expect.objectContaining({ id: "s1", name: "Alice" }),
      ]);
    });

    it("returns paginated response when page specified", async () => {
      mockRepo.findManyPaginated.mockResolvedValue({
        data: [],
        total: 0,
      } as never);

      const result = await staffService.listPaginated({ search: "", page: 1, pageSize: 20 });

      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe("getById", () => {
    it("returns staff detail DTO", async () => {
      mockRepo.findById.mockResolvedValue({
        id: "s1",
        name: "Alice",
        title: "Manager",
        department: "IT",
        accountCode: "AC1",
        extension: "x100",
        email: "alice@test.com",
        phone: "555-1234",
        approvalChain: ["Bob"],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        accountNumbers: [
          { id: "a1", staffId: "s1", accountCode: "1234", description: "Main", lastUsedAt: new Date("2026-01-01"), createdAt: new Date() },
        ],
        signerHistories: [
          { id: "h1", staffId: "s1", position: 1, signer: { id: "s2", name: "Bob", title: "Director" } },
        ],
      } as never);

      const result = await staffService.getById("s1");

      expect(result).not.toBeNull();
      expect(result!.accountNumbers[0].accountCode).toBe("1234");
      expect(result!.signerHistories[0].signer.name).toBe("Bob");
    });

    it("returns null for missing staff", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const result = await staffService.getById("missing");
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domains/staff/service.test.ts 2>&1 | tail -20`
Expected: FAIL — module `@/domains/staff/service` not found

- [ ] **Step 3: Implement staff service**

```typescript
// src/domains/staff/service.ts
import { staffRepository } from "./repository";
import type {
  StaffResponse,
  StaffDetailResponse,
  StaffFilters,
  CreateStaffInput,
  UpdateStaffInput,
  UpsertAccountNumberInput,
  AccountNumberResponse,
} from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

function toStaffResponse(staff: {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
  active: boolean;
}): StaffResponse {
  return {
    id: staff.id,
    name: staff.name,
    title: staff.title,
    department: staff.department,
    accountCode: staff.accountCode,
    extension: staff.extension,
    email: staff.email,
    phone: staff.phone,
    approvalChain: staff.approvalChain,
    active: staff.active,
  };
}

function toDetailResponse(staff: Awaited<ReturnType<typeof staffRepository.findById>>): StaffDetailResponse | null {
  if (!staff) return null;
  return {
    ...toStaffResponse(staff),
    accountNumbers: staff.accountNumbers.map((a) => ({
      id: a.id,
      accountCode: a.accountCode,
      description: a.description,
      lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
    })),
    signerHistories: staff.signerHistories.map((h) => ({
      position: h.position,
      signer: {
        id: h.signer.id,
        name: h.signer.name,
        title: h.signer.title,
        department: h.signer.department,
      },
    })),
  };
}

export const staffService = {
  async list(filters: StaffFilters): Promise<StaffResponse[]> {
    const staff = await staffRepository.findMany(filters);
    return staff.map(toStaffResponse);
  },

  async listPaginated(filters: StaffFilters & { page: number; pageSize: number }): Promise<PaginatedResponse<StaffResponse>> {
    const { data, total } = await staffRepository.findManyPaginated(filters);
    return {
      data: data.map(toStaffResponse),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  },

  async getById(id: string): Promise<StaffDetailResponse | null> {
    const staff = await staffRepository.findById(id);
    return toDetailResponse(staff);
  },

  async create(input: CreateStaffInput): Promise<StaffResponse> {
    const staff = await staffRepository.create(input);
    return toStaffResponse(staff);
  },

  async update(id: string, input: UpdateStaffInput): Promise<StaffDetailResponse | null> {
    const staff = await staffRepository.update(id, input);
    return toDetailResponse(staff);
  },

  async partialUpdate(id: string, input: UpdateStaffInput): Promise<StaffDetailResponse | null> {
    const staff = await staffRepository.partialUpdate(id, input);
    return toDetailResponse(staff);
  },

  async softDelete(id: string): Promise<void> {
    await staffRepository.softDelete(id);
  },

  async getAccountNumbers(staffId: string): Promise<AccountNumberResponse[]> {
    const rows = await staffRepository.findAccountNumbers(staffId);
    return rows.map((a) => ({
      id: a.id,
      accountCode: a.accountCode,
      description: a.description,
      lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
    }));
  },

  async upsertAccountNumber(input: UpsertAccountNumberInput): Promise<void> {
    await staffRepository.upsertAccountNumber(input);
  },

  async recordSignerHistory(invoiceId: string, staffId: string, position: number, signerId: string): Promise<void> {
    await staffRepository.upsertSignerHistory(invoiceId, staffId, position, signerId);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domains/staff/service.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/staff/service.ts tests/domains/staff/service.test.ts
git commit -m "feat: add staff service with DTO mapping and tests"
```

---

### Task 8: Staff API Client & Hooks

**Files:**
- Create: `src/domains/staff/api-client.ts`
- Create: `src/domains/staff/hooks.ts`

- [ ] **Step 1: Create staff API client**

```typescript
// src/domains/staff/api-client.ts
import { ApiError } from "@/domains/shared/types";
import type {
  StaffResponse,
  StaffDetailResponse,
  StaffFilters,
  CreateStaffInput,
  UpdateStaffInput,
  AccountNumberResponse,
  UpsertAccountNumberInput,
} from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

const BASE = "/api/staff";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export const staffApi = {
  async list(filters?: StaffFilters): Promise<StaffResponse[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    return request<StaffResponse[]>(`${BASE}${qs ? `?${qs}` : ""}`);
  },

  async listPaginated(filters: StaffFilters & { page: number; pageSize: number }): Promise<PaginatedResponse<StaffResponse>> {
    const params = new URLSearchParams({
      paginated: "true",
      page: String(filters.page),
      pageSize: String(filters.pageSize),
    });
    if (filters.search) params.set("search", filters.search);
    return request<PaginatedResponse<StaffResponse>>(`${BASE}?${params}`);
  },

  async getById(id: string): Promise<StaffDetailResponse> {
    return request<StaffDetailResponse>(`${BASE}/${id}`);
  },

  async create(input: CreateStaffInput): Promise<StaffResponse> {
    return request<StaffResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateStaffInput): Promise<StaffDetailResponse> {
    return request<StaffDetailResponse>(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async partialUpdate(id: string, input: UpdateStaffInput): Promise<StaffDetailResponse> {
    return request<StaffDetailResponse>(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },

  async getAccountNumbers(staffId: string): Promise<AccountNumberResponse[]> {
    return request<AccountNumberResponse[]>(`${BASE}/${staffId}/account-numbers`);
  },

  async upsertAccountNumber(staffId: string, input: Omit<UpsertAccountNumberInput, "staffId">): Promise<void> {
    await request(`${BASE}/${staffId}/account-numbers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};
```

- [ ] **Step 2: Create staff hooks**

```typescript
// src/domains/staff/hooks.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { staffApi } from "./api-client";
import { handleApiError } from "@/domains/shared/errors";
import type { StaffResponse, StaffDetailResponse, StaffFilters } from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

export function useStaffList(filters?: StaffFilters) {
  const [data, setData] = useState<StaffResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await staffApi.list(filters));
    } catch (e) {
      handleApiError(e, "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [filters?.search]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

export function useStaffListPaginated(filters: StaffFilters & { page: number; pageSize: number }) {
  const [data, setData] = useState<PaginatedResponse<StaffResponse> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await staffApi.listPaginated(filters));
    } catch (e) {
      handleApiError(e, "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.page, filters.pageSize]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

export function useStaff(id: string | null) {
  const [data, setData] = useState<StaffDetailResponse | null>(null);
  const [loading, setLoading] = useState(!!id);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await staffApi.getById(id));
    } catch (e) {
      handleApiError(e, "Failed to load staff member");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/domains/staff/api-client.ts src/domains/staff/hooks.ts
git commit -m "feat: add staff API client and React hooks"
```

---

### Task 9: Refactor Staff Routes to Thin Dispatchers

**Files:**
- Modify: `src/app/api/staff/route.ts`
- Modify: `src/app/api/staff/[id]/route.ts`
- Modify: `src/app/api/staff/[id]/account-numbers/route.ts`

- [ ] **Step 1: Refactor staff list/create route**

Replace the contents of `src/app/api/staff/route.ts`:

```typescript
// src/app/api/staff/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffSchema } from "@/lib/validators";

export const GET = withAuth(async (req) => {
  const params = req.nextUrl.searchParams;
  const search = params.get("search") ?? undefined;
  const paginated = params.get("paginated") === "true";

  if (paginated) {
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 20));
    const result = await staffService.listPaginated({ search, page, pageSize });
    return NextResponse.json(result);
  }

  const staff = await staffService.list({ search });
  return NextResponse.json(staff);
});

export const POST = withAuth(async (req) => {
  const body = staffSchema.parse(await req.json());
  const staff = await staffService.create(body);
  return NextResponse.json(staff, { status: 201 });
});
```

- [ ] **Step 2: Refactor staff detail route**

Replace the contents of `src/app/api/staff/[id]/route.ts`:

```typescript
// src/app/api/staff/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(async (req: NextRequest, session, ctx?: RouteContext) => {
  // Note: Next.js App Router passes context as 2nd arg to route handlers,
  // but withAuth shifts it. We need to extract id from the URL instead.
  const id = req.nextUrl.pathname.split("/").pop()!;
  const staff = await staffService.getById(id);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PUT = withAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").at(-1)!;
  const body = staffSchema.parse(await req.json());
  const staff = await staffService.update(id, body);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PATCH = withAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").at(-1)!;
  const body = staffSchema.partial().parse(await req.json());
  const staff = await staffService.partialUpdate(id, body);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const DELETE = withAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").at(-1)!;
  await staffService.softDelete(id);
  return NextResponse.json({ success: true });
});
```

Wait — the `withAuth` wrapper only passes `(req, session)` but Next.js route handlers receive `(req, { params })`. We need to update `withAuth` to forward the context. Let me adjust:

**Update `src/domains/shared/auth.ts`** to pass through route context:

```typescript
// src/domains/shared/auth.ts
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { AuthSession } from "./types";

type RouteContext = { params: Promise<Record<string, string>> };
type AuthHandler = (req: NextRequest, session: AuthSession, ctx?: RouteContext) => Promise<NextResponse>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest, ctx?: RouteContext): Promise<NextResponse> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, session as unknown as AuthSession, ctx);
  };
}

export function withAdmin(handler: AuthHandler) {
  return async (req: NextRequest, ctx?: RouteContext): Promise<NextResponse> => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (session.user as unknown as { role: string }).role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, session as unknown as AuthSession, ctx);
  };
}
```

Now the route can use context properly:

```typescript
// src/app/api/staff/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffSchema } from "@/lib/validators";

export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const staff = await staffService.getById(id);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PUT = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const body = staffSchema.parse(await req.json());
  const staff = await staffService.update(id, body);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PATCH = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const body = staffSchema.partial().parse(await req.json());
  const staff = await staffService.partialUpdate(id, body);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const DELETE = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  await staffService.softDelete(id);
  return NextResponse.json({ success: true });
});
```

- [ ] **Step 3: Refactor account numbers route**

Replace the contents of `src/app/api/staff/[id]/account-numbers/route.ts`:

```typescript
// src/app/api/staff/[id]/account-numbers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffAccountNumberSchema } from "@/lib/validators";

export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const accounts = await staffService.getAccountNumbers(id);
  return NextResponse.json(accounts);
});

export const POST = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const body = staffAccountNumberSchema.parse(await req.json());
  await staffService.upsertAccountNumber({
    staffId: id,
    accountCode: body.accountCode.trim(),
    description: body.description?.trim(),
  });
  return NextResponse.json({ success: true }, { status: 201 });
});
```

- [ ] **Step 4: Update auth test for new context parameter**

Update `tests/domains/shared/auth.test.ts` — the `handler` mock calls now receive 3 args:

```typescript
// In the "calls handler with session when authenticated" test, update assertion:
expect(handler).toHaveBeenCalledWith(req, session, undefined);

// In the "calls handler when admin" test, update assertion:
expect(handler).toHaveBeenCalledWith(req, session, undefined);
```

- [ ] **Step 5: Run all tests to verify nothing broke**

Run: `npx vitest run 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 6: Manually verify staff CRUD works**

1. Open the app in browser
2. Navigate to staff directory
3. Search for a staff member
4. Create a new staff member
5. Edit an existing staff member
6. Verify account numbers load on invoice form staff select

- [ ] **Step 7: Commit**

```bash
git add src/domains/shared/auth.ts tests/domains/shared/auth.test.ts src/app/api/staff/route.ts src/app/api/staff/[id]/route.ts src/app/api/staff/[id]/account-numbers/route.ts
git commit -m "refactor: staff routes use withAuth + staffService as thin dispatchers"
```

---

### Task 10: Update Staff Components to Use API Client

**Files:**
- Modify: `src/components/invoice/staff-select.tsx`
- Modify: `src/components/staff/staff-table.tsx`
- Modify: `src/components/staff/staff-form.tsx`

- [ ] **Step 1: Update StaffSelect to use staffApi**

In `src/components/invoice/staff-select.tsx`:

1. Remove the local `StaffMember` interface (lines 20-31)
2. Add imports:
   ```typescript
   import { staffApi } from "@/domains/staff/api-client";
   import type { StaffResponse } from "@/domains/staff/types";
   ```
3. Replace the `StaffMember` type with `StaffResponse` throughout
4. Replace the fetch call (around line 54):
   ```typescript
   // Before:
   const res = await fetch("/api/staff");
   const data = await res.json();

   // After:
   const data = await staffApi.list();
   ```

- [ ] **Step 2: Update StaffTable to use staffApi and shared types**

In `src/components/staff/staff-table.tsx`:

1. Remove the local `StaffMember` interface (lines 21-31)
2. Add imports:
   ```typescript
   import { staffApi } from "@/domains/staff/api-client";
   import type { StaffResponse } from "@/domains/staff/types";
   ```
3. Replace `StaffMember` with `StaffResponse` throughout
4. Replace fetch calls:
   ```typescript
   // Load staff (around line 50):
   // Before:
   const res = await fetch(`/api/staff?${params}`);
   const data = await res.json();
   // After:
   const data = await staffApi.listPaginated({ search, page, pageSize });
   // Adjust usage: data.data for the array, data.total for count

   // Delete staff (around line 76):
   // Before:
   await fetch(`/api/staff/${id}`, { method: "DELETE" });
   // After:
   await staffApi.delete(id);
   ```

- [ ] **Step 3: Update StaffForm to use staffApi and shared types**

In `src/components/staff/staff-form.tsx`:

1. Remove the local `StaffMember` interface (lines 16-26)
2. Add imports:
   ```typescript
   import { staffApi } from "@/domains/staff/api-client";
   import type { StaffResponse } from "@/domains/staff/types";
   ```
3. Replace `StaffMember` with `StaffResponse` throughout
4. Replace fetch calls:
   ```typescript
   // Create (around line 91):
   // Before:
   const res = await fetch("/api/staff", { method: "POST", ... });
   // After:
   const result = await staffApi.create(formData);

   // Update (around line 94):
   // Before:
   const res = await fetch(`/api/staff/${staff.id}`, { method: "PUT", ... });
   // After:
   const result = await staffApi.update(staff.id, formData);
   ```

- [ ] **Step 4: Verify app still works**

Run: `npx vitest run 2>&1 | tail -20`
Then manually verify staff select, staff table, and staff form all function correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/invoice/staff-select.tsx src/components/staff/staff-table.tsx src/components/staff/staff-form.tsx
git commit -m "refactor: staff components use staffApi and shared types"
```

---

### Task 11: Update Invoice Form Staff Interface

**Files:**
- Modify: `src/components/invoice/invoice-form.tsx`

- [ ] **Step 1: Replace local StaffMember interface with import**

In `src/components/invoice/invoice-form.tsx`:

1. Add import:
   ```typescript
   import type { StaffDetailResponse } from "@/domains/staff/types";
   import { staffApi } from "@/domains/staff/api-client";
   ```

2. Remove the local `StaffMember` interface (lines 76-88), `StaffAccountNumber` interface (lines 60-65), and `SignerHistory` interface (lines 67-74)

3. Replace `StaffMember` with `StaffDetailResponse` in the `handleStaffSelect` callback and anywhere else it appears

4. Update the auto-save fetch call (around line 361):
   ```typescript
   // Before:
   await fetch(`/api/staff/${form.staffId}`, { method: "PATCH", ... });
   // After:
   await staffApi.partialUpdate(form.staffId, patchData);
   ```

- [ ] **Step 2: Run tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 3: Manually verify invoice form staff selection and autofill**

1. Create new invoice
2. Select a staff member
3. Verify contact info, department, account code populate
4. Verify signature history loads

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice/invoice-form.tsx
git commit -m "refactor: invoice form uses staff domain types and api-client"
```

---

## Phase 3: PDF Domain

### Task 12: PDF Types & Storage

**Files:**
- Create: `src/domains/pdf/types.ts`
- Create: `src/domains/pdf/storage.ts`
- Create: `tests/domains/pdf/storage.test.ts`

- [ ] **Step 1: Create PDF domain types**

```typescript
// src/domains/pdf/types.ts

export interface CoverSheetData {
  date: string;
  semesterYearDept: string;
  invoiceNumber: string;
  chargeAccountNumber: string;
  accountCode: string;
  totalAmount: string;
  signatures: { name: string; title?: string }[];
}

export interface IDPOverlayData {
  date: string;
  department: string;
  documentNumber: string;
  requestingDept: string;
  sapAccount: string;
  estimatedCost: string;
  approverName: string;
  contactName: string;
  contactPhone: string;
  comments?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: string;
    extendedPrice: string;
  }[];
  totalAmount: string;
}

export interface QuotePDFData {
  quoteNumber: string;
  date: string;
  expirationDate: string;
  recipientName: string;
  recipientEmail: string;
  recipientOrg: string;
  department: string;
  category: string;
  accountCode: string;
  notes: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: string;
    extendedPrice: string;
  }[];
  totalAmount: number;
}

export interface GenerateInvoicePDFInput {
  coverSheet: CoverSheetData;
  idp: IDPOverlayData;
}

export interface GenerateInvoiceResult {
  pdfPath: string;
}
```

- [ ] **Step 2: Write failing test for PDF storage**

```typescript
// tests/domains/pdf/storage.test.ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { pdfStorage } from "@/domains/pdf/storage";

const TEST_DIR = join(process.cwd(), "data", "pdfs", "__test__");

describe("pdfStorage", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(join(TEST_DIR, "test.pdf"), Buffer.from("fake-pdf"));
  });

  afterAll(async () => {
    const { rm } = await import("fs/promises");
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("reads a PDF file and returns buffer", async () => {
    const buf = await pdfStorage.read(join(TEST_DIR, "test.pdf"));
    expect(buf.toString()).toBe("fake-pdf");
  });

  it("throws on non-existent file", async () => {
    await expect(pdfStorage.read(join(TEST_DIR, "nope.pdf"))).rejects.toThrow();
  });

  it("deletes a file safely", async () => {
    const path = join(TEST_DIR, "to-delete.pdf");
    await writeFile(path, Buffer.from("delete-me"));
    await pdfStorage.delete(path);
    await expect(readFile(path)).rejects.toThrow();
  });

  it("resolves a relative path within public/", () => {
    const abs = pdfStorage.resolvePublicPath("uploads/file.pdf");
    expect(abs).toContain("public");
    expect(abs).toContain("uploads/file.pdf");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/domains/pdf/storage.test.ts 2>&1 | tail -20`
Expected: FAIL — module `@/domains/pdf/storage` not found

- [ ] **Step 4: Implement PDF storage**

```typescript
// src/domains/pdf/storage.ts
import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join, resolve } from "path";

const PDF_DIR = join(process.cwd(), "data", "pdfs");

export const pdfStorage = {
  /** Ensures the PDF output directory exists */
  async ensureDir(): Promise<string> {
    await mkdir(PDF_DIR, { recursive: true });
    return PDF_DIR;
  },

  /** Full path for a given filename in the PDF directory */
  pathFor(filename: string): string {
    return join(PDF_DIR, filename);
  },

  /** Read a PDF file from an absolute path */
  async read(absolutePath: string): Promise<Buffer> {
    return readFile(absolutePath);
  },

  /** Write a buffer to an absolute path */
  async write(absolutePath: string, data: Buffer): Promise<void> {
    const dir = absolutePath.substring(0, absolutePath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(absolutePath, data);
  },

  /** Delete a file if it exists */
  async delete(absolutePath: string): Promise<void> {
    await unlink(absolutePath);
  },

  /** Safely delete — no error if file doesn't exist */
  async safeDelete(absolutePath: string): Promise<void> {
    try {
      await unlink(absolutePath);
    } catch {
      // File may not exist, that's fine
    }
  },

  /** Resolve a relative path within the public/ directory */
  resolvePublicPath(relativePath: string): string {
    const resolved = resolve(process.cwd(), "public", relativePath);
    // Safety check: must stay within public/
    if (!resolved.startsWith(resolve(process.cwd(), "public"))) {
      throw new Error("Path traversal detected");
    }
    return resolved;
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/domains/pdf/storage.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/domains/pdf/types.ts src/domains/pdf/storage.ts tests/domains/pdf/storage.test.ts
git commit -m "feat: add PDF domain types and storage abstraction with tests"
```

---

### Task 13: PDF Service

**Files:**
- Create: `src/domains/pdf/service.ts`

- [ ] **Step 1: Create PDF service**

This wraps the existing `generateInvoicePDF`, `generateQuotePDF`, and `mergePrismCorePDF` functions, moving the data transformation logic out of route handlers.

```typescript
// src/domains/pdf/service.ts
import { generateInvoicePDF } from "@/lib/pdf/generate";
import { generateQuotePDF } from "@/lib/pdf/generate-quote";
import { mergePrismCorePDF } from "@/lib/pdf/merge";
import { pdfStorage } from "./storage";
import type { GenerateInvoicePDFInput, QuotePDFData } from "./types";

export const pdfService = {
  /** Generate a full invoice PDF (cover sheet + IDP) and return the file path */
  async generateInvoice(input: GenerateInvoicePDFInput): Promise<string> {
    return generateInvoicePDF(input);
  },

  /** Merge a PrismCore PDF into an existing invoice PDF after page 1 */
  async mergePrismCore(invoicePdfPath: string, prismcoreRelativePath: string): Promise<void> {
    return mergePrismCorePDF(invoicePdfPath, prismcoreRelativePath);
  },

  /** Generate a quote PDF and return the file path */
  async generateQuote(data: QuotePDFData): Promise<string> {
    return generateQuotePDF(data);
  },

  /** Read a PDF file for streaming to client */
  async readPdf(absolutePath: string): Promise<Buffer> {
    return pdfStorage.read(absolutePath);
  },

  /** Delete a PDF and optionally its PrismCore companion */
  async deletePdfFiles(pdfPath: string | null, prismcorePath: string | null): Promise<void> {
    if (pdfPath) await pdfStorage.safeDelete(pdfPath);
    if (prismcorePath) {
      const absPath = pdfStorage.resolvePublicPath(prismcorePath);
      await pdfStorage.safeDelete(absPath);
    }
  },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/pdf/service.ts
git commit -m "feat: add PDF service wrapping generation, merge, and storage"
```

---

## Phase 4: Invoice Domain

### Task 14: Invoice Types & Constants

**Files:**
- Create: `src/domains/invoice/types.ts`
- Create: `src/domains/invoice/constants.ts`

- [ ] **Step 1: Create invoice constants**

```typescript
// src/domains/invoice/constants.ts
export const TAX_RATE = 0.095;

export const INVOICE_STATUSES = ["DRAFT", "FINAL", "PENDING_CHARGE"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
```

- [ ] **Step 2: Create invoice domain types**

```typescript
// src/domains/invoice/types.ts
import type { StaffSummary } from "@/domains/staff/types";
import type { InvoiceStatus } from "./constants";

// ── Internal (repository <-> service) ──
export interface InvoiceWithRelations {
  id: string;
  invoiceNumber: string | null;
  date: Date;
  status: string;
  type: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  approvalChain: string[];
  notes: string;
  totalAmount: unknown; // Prisma Decimal — always Number() before use
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringEmail: string | null;
  isRunning: boolean;
  runningTitle: string | null;
  pdfPath: string | null;
  prismcorePath: string | null;
  createdAt: Date;
  updatedAt: Date;
  staffId: string;
  creatorId: string;
  staff: { id: string; name: string; title: string; department: string };
  creator: { id: string; name: string };
  items: InvoiceItemRow[];
}

export interface InvoiceItemRow {
  id: string;
  description: string;
  quantity: unknown; // Prisma Decimal
  unitPrice: unknown; // Prisma Decimal
  extendedPrice: unknown; // Prisma Decimal
  sortOrder: number;
}

// ── DTOs ──
export interface InvoiceResponse {
  id: string;
  invoiceNumber: string | null;
  date: string;
  status: InvoiceStatus;
  type: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  approvalChain: string[];
  notes: string;
  totalAmount: number;
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringEmail: string | null;
  isRunning: boolean;
  runningTitle: string | null;
  pdfPath: string | null;
  prismcorePath: string | null;
  createdAt: string;
  staff: StaffSummary;
  creatorName: string;
  items: InvoiceItemResponse[];
}

export interface InvoiceItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number;
}

export interface CreateInvoiceInput {
  invoiceNumber?: string | null;
  date: string;
  staffId: string;
  department: string;
  category: string;
  accountCode?: string;
  accountNumber?: string;
  approvalChain?: string[];
  notes?: string;
  items: CreateLineItemInput[];
  isRecurring?: boolean;
  recurringInterval?: string;
  recurringEmail?: string;
  isRunning?: boolean;
  runningTitle?: string;
  status?: "DRAFT" | "PENDING_CHARGE";
}

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus;
  staffId?: string;
  department?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  creatorId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface FinalizeInput {
  prismcorePath?: string;
  signatures?: { line1?: string; line2?: string; line3?: string };
  signatureStaffIds?: { line1?: string; line2?: string; line3?: string };
  semesterYearDept?: string;
  contactName?: string;
  contactExtension?: string;
}

export interface InvoiceStatsResponse {
  total: number;
  sumTotalAmount: number;
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/domains/invoice/types.ts src/domains/invoice/constants.ts
git commit -m "feat: add invoice domain types and constants"
```

---

### Task 15: Invoice Calculations (Single Source for Duplicated Logic)

**Files:**
- Create: `src/domains/invoice/calculations.ts`
- Create: `tests/domains/invoice/calculations.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domains/invoice/calculations.test.ts
import { describe, it, expect } from "vitest";
import { calculateLineItems, calculateTotal } from "@/domains/invoice/calculations";

describe("calculateLineItems", () => {
  it("computes extendedPrice for each item", () => {
    const items = [
      { description: "Widget", quantity: 3, unitPrice: 10.5 },
      { description: "Gadget", quantity: 1, unitPrice: 25 },
    ];
    const result = calculateLineItems(items);
    expect(result[0].extendedPrice).toBe(31.5);
    expect(result[1].extendedPrice).toBe(25);
  });

  it("handles string inputs (Prisma Decimal)", () => {
    const items = [
      { description: "Item", quantity: "2" as unknown as number, unitPrice: "15.50" as unknown as number },
    ];
    const result = calculateLineItems(items);
    expect(result[0].extendedPrice).toBe(31);
  });

  it("returns empty array for empty input", () => {
    expect(calculateLineItems([])).toEqual([]);
  });
});

describe("calculateTotal", () => {
  it("sums extendedPrices", () => {
    const items = [
      { description: "A", quantity: 1, unitPrice: 10, extendedPrice: 10, sortOrder: 0 },
      { description: "B", quantity: 2, unitPrice: 5, extendedPrice: 10, sortOrder: 1 },
    ];
    expect(calculateTotal(items)).toBe(20);
  });

  it("handles Decimal strings in extendedPrice", () => {
    const items = [
      { description: "A", quantity: 1, unitPrice: 10, extendedPrice: "15.50" as unknown as number, sortOrder: 0 },
    ];
    expect(calculateTotal(items)).toBe(15.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domains/invoice/calculations.test.ts 2>&1 | tail -20`
Expected: FAIL — module not found

- [ ] **Step 3: Implement calculations**

```typescript
// src/domains/invoice/calculations.ts
import type { CreateLineItemInput } from "./types";

export interface CalculatedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

/**
 * Compute extendedPrice for each line item.
 * Handles both number and string inputs (Prisma Decimal comes as string).
 * This is the SINGLE SOURCE for this calculation — replaces 4 duplicates.
 */
export function calculateLineItems(
  items: (CreateLineItemInput & { sortOrder?: number })[]
): CalculatedLineItem[] {
  return items.map((item, index) => {
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    return {
      description: item.description,
      quantity: qty,
      unitPrice: price,
      extendedPrice: qty * price,
      sortOrder: item.sortOrder ?? index,
    };
  });
}

/**
 * Sum all extendedPrices. Handles Decimal strings.
 */
export function calculateTotal(items: { extendedPrice: number | unknown }[]): number {
  return items.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domains/invoice/calculations.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/invoice/calculations.ts tests/domains/invoice/calculations.test.ts
git commit -m "feat: add invoice calculations (single source, replaces 4 duplicates)"
```

---

### Task 16: Invoice Repository

**Files:**
- Create: `src/domains/invoice/repository.ts`

- [ ] **Step 1: Create invoice repository**

Extract all Prisma queries from invoice routes into a single repository. This is a large file but each method is a focused query.

```typescript
// src/domains/invoice/repository.ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { InvoiceFilters, CreateInvoiceInput } from "./types";
import type { CalculatedLineItem } from "./calculations";

const includeRelations = {
  staff: { select: { id: true, name: true, title: true, department: true } },
  creator: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
} as const;

function buildWhere(filters: InvoiceFilters, type: "INVOICE" | "QUOTE" = "INVOICE"): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { type };

  if (filters.status) where.status = filters.status;
  if (filters.staffId) where.staffId = filters.staffId;
  if (filters.department) where.department = filters.department;
  if (filters.category) where.category = filters.category;
  if (filters.creatorId) where.creatorId = filters.creatorId;

  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
  }

  if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
    where.totalAmount = {};
    if (filters.amountMin !== undefined) where.totalAmount.gte = filters.amountMin;
    if (filters.amountMax !== undefined) where.totalAmount.lte = filters.amountMax;
  }

  if (filters.search) {
    where.OR = [
      { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
      { department: { contains: filters.search, mode: "insensitive" } },
      { staff: { name: { contains: filters.search, mode: "insensitive" } } },
      { notes: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export const invoiceRepository = {
  async findMany(filters: InvoiceFilters) {
    const where = buildWhere(filters);
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const sortBy = filters.sortBy ?? "createdAt";
    const sortOrder = filters.sortOrder ?? "desc";

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: includeRelations,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { data, total, page, pageSize };
  },

  async findById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: includeRelations,
    });
  },

  async create(
    input: CreateInvoiceInput,
    calculatedItems: CalculatedLineItem[],
    totalAmount: number,
    creatorId: string
  ) {
    return prisma.invoice.create({
      data: {
        invoiceNumber: input.invoiceNumber || null,
        date: new Date(input.date),
        status: input.status ?? "DRAFT",
        type: "INVOICE",
        department: input.department,
        category: input.category,
        accountCode: input.accountCode ?? "",
        accountNumber: input.accountNumber ?? "",
        approvalChain: input.approvalChain ?? [],
        notes: input.notes ?? "",
        totalAmount,
        isRecurring: input.isRecurring ?? false,
        recurringInterval: input.recurringInterval ?? null,
        recurringEmail: input.recurringEmail ?? null,
        isRunning: input.isRunning ?? false,
        runningTitle: input.runningTitle ?? null,
        staffId: input.staffId,
        creatorId,
        items: {
          create: calculatedItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            extendedPrice: item.extendedPrice,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: includeRelations,
    });
  },

  async update(
    id: string,
    input: Partial<CreateInvoiceInput>,
    calculatedItems: CalculatedLineItem[] | undefined,
    totalAmount: number | undefined
  ) {
    return prisma.$transaction(async (tx) => {
      if (calculatedItems) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: calculatedItems.map((item) => ({
            invoiceId: id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            extendedPrice: item.extendedPrice,
            sortOrder: item.sortOrder,
          })),
        });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...(input.invoiceNumber !== undefined && { invoiceNumber: input.invoiceNumber || null }),
          ...(input.date && { date: new Date(input.date) }),
          ...(input.department && { department: input.department }),
          ...(input.category && { category: input.category }),
          ...(input.accountCode !== undefined && { accountCode: input.accountCode }),
          ...(input.accountNumber !== undefined && { accountNumber: input.accountNumber }),
          ...(input.approvalChain && { approvalChain: input.approvalChain }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(totalAmount !== undefined && { totalAmount }),
          ...(input.isRecurring !== undefined && { isRecurring: input.isRecurring }),
          ...(input.recurringInterval !== undefined && { recurringInterval: input.recurringInterval }),
          ...(input.recurringEmail !== undefined && { recurringEmail: input.recurringEmail }),
          ...(input.isRunning !== undefined && { isRunning: input.isRunning }),
          ...(input.runningTitle !== undefined && { runningTitle: input.runningTitle }),
          ...(input.status && { status: input.status }),
          ...(input.staffId && { staffId: input.staffId }),
        },
        include: includeRelations,
      });
    });
  },

  async delete(id: string) {
    return prisma.invoice.delete({ where: { id } });
  },

  async finalize(id: string, pdfPath: string, prismcorePath?: string) {
    return prisma.invoice.update({
      where: { id },
      data: {
        status: "FINAL",
        pdfPath,
        ...(prismcorePath && { prismcorePath }),
      },
      include: includeRelations,
    });
  },

  async countAndSum(filters: InvoiceFilters): Promise<{ count: number; sum: number }> {
    const where = buildWhere(filters);
    const [countResult, sumResult] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({ where, _sum: { totalAmount: true } }),
    ]);
    return {
      count: countResult,
      sum: Number(sumResult._sum.totalAmount ?? 0),
    };
  },

  async incrementQuickPickUsage(department: string, descriptions: string[]) {
    await Promise.all([
      prisma.quickPickItem.updateMany({
        where: { department, description: { in: descriptions } },
        data: { usageCount: { increment: 1 } },
      }),
      prisma.savedLineItem.updateMany({
        where: { department, description: { in: descriptions } },
        data: { usageCount: { increment: 1 } },
      }),
    ]);
  },
};
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/invoice/repository.ts
git commit -m "feat: add invoice repository consolidating all Prisma queries"
```

---

### Task 17: Invoice Service

**Files:**
- Create: `src/domains/invoice/service.ts`

- [ ] **Step 1: Create invoice service**

```typescript
// src/domains/invoice/service.ts
import { invoiceRepository } from "./repository";
import { calculateLineItems, calculateTotal } from "./calculations";
import { pdfService } from "@/domains/pdf/service";
import { staffService } from "@/domains/staff/service";
import { formatCurrency, formatDateFromDate } from "@/domains/shared/formatters";
import type {
  InvoiceResponse,
  InvoiceItemResponse,
  InvoiceFilters,
  CreateInvoiceInput,
  FinalizeInput,
  InvoiceStatsResponse,
} from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

function parseSignature(raw: string): { name: string; title?: string } {
  const commaIdx = raw.indexOf(",");
  if (commaIdx === -1) return { name: raw.trim() };
  return {
    name: raw.slice(0, commaIdx).trim(),
    title: raw.slice(commaIdx + 1).trim() || undefined,
  };
}

function toItemResponse(item: { id: string; description: string; quantity: unknown; unitPrice: unknown; extendedPrice: unknown; sortOrder: number }): InvoiceItemResponse {
  return {
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    extendedPrice: Number(item.extendedPrice),
    sortOrder: item.sortOrder,
  };
}

function toInvoiceResponse(invoice: NonNullable<Awaited<ReturnType<typeof invoiceRepository.findById>>>): InvoiceResponse {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date.toISOString(),
    status: invoice.status as InvoiceResponse["status"],
    type: invoice.type,
    department: invoice.department,
    category: invoice.category,
    accountCode: invoice.accountCode,
    accountNumber: invoice.accountNumber,
    approvalChain: invoice.approvalChain,
    notes: invoice.notes,
    totalAmount: Number(invoice.totalAmount),
    isRecurring: invoice.isRecurring,
    recurringInterval: invoice.recurringInterval,
    recurringEmail: invoice.recurringEmail,
    isRunning: invoice.isRunning,
    runningTitle: invoice.runningTitle,
    pdfPath: invoice.pdfPath,
    prismcorePath: invoice.prismcorePath,
    createdAt: invoice.createdAt.toISOString(),
    staff: invoice.staff,
    creatorName: invoice.creator.name,
    items: invoice.items.map(toItemResponse),
  };
}

export const invoiceService = {
  async list(filters: InvoiceFilters): Promise<PaginatedResponse<InvoiceResponse>> {
    const { data, total, page, pageSize } = await invoiceRepository.findMany(filters);
    return {
      data: data.map(toInvoiceResponse),
      total,
      page,
      pageSize,
    };
  },

  async getById(id: string): Promise<InvoiceResponse | null> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) return null;
    return toInvoiceResponse(invoice);
  },

  async create(input: CreateInvoiceInput, creatorId: string): Promise<InvoiceResponse> {
    const calculatedItems = calculateLineItems(input.items);
    const totalAmount = calculateTotal(calculatedItems);
    const invoice = await invoiceRepository.create(input, calculatedItems, totalAmount, creatorId);

    // Non-critical: track account number usage
    if (input.accountNumber) {
      staffService.upsertAccountNumber({
        staffId: input.staffId,
        accountCode: input.accountNumber,
      }).catch(() => {});
    }

    return toInvoiceResponse(invoice);
  },

  async update(id: string, input: Partial<CreateInvoiceInput>): Promise<InvoiceResponse | null> {
    const existing = await invoiceRepository.findById(id);
    if (!existing) return null;
    if (existing.status === "FINAL") {
      throw new Error("Cannot update a finalized invoice");
    }

    let calculatedItems;
    let totalAmount;
    if (input.items) {
      calculatedItems = calculateLineItems(input.items);
      totalAmount = calculateTotal(calculatedItems);
    }

    const invoice = await invoiceRepository.update(id, input, calculatedItems, totalAmount);
    return toInvoiceResponse(invoice);
  },

  async delete(id: string): Promise<void> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) return;

    // Clean up PDF files
    await pdfService.deletePdfFiles(invoice.pdfPath, invoice.prismcorePath);
    await invoiceRepository.delete(id);
  },

  async finalize(id: string, input: FinalizeInput): Promise<InvoiceResponse> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "FINAL") throw new Error("Invoice already finalized");
    if (!invoice.invoiceNumber) throw new Error("Invoice number required before finalizing");

    // Parse signatures
    const signatures = [
      input.signatures?.line1,
      input.signatures?.line2,
      input.signatures?.line3,
    ]
      .filter(Boolean)
      .map((s) => parseSignature(s!));

    // Build PDF data
    const pdfPath = await pdfService.generateInvoice({
      coverSheet: {
        date: formatDateFromDate(invoice.date),
        semesterYearDept: input.semesterYearDept ?? "",
        invoiceNumber: invoice.invoiceNumber,
        chargeAccountNumber: invoice.accountNumber,
        accountCode: invoice.accountCode,
        totalAmount: formatCurrency(invoice.totalAmount),
        signatures,
      },
      idp: {
        date: formatDateFromDate(invoice.date),
        department: invoice.department,
        documentNumber: invoice.invoiceNumber,
        requestingDept: invoice.department,
        sapAccount: invoice.accountNumber,
        estimatedCost: formatCurrency(invoice.totalAmount),
        approverName: invoice.staff.name,
        contactName: input.contactName ?? "",
        contactPhone: input.contactExtension ?? "",
        comments: invoice.notes || undefined,
        items: invoice.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: formatCurrency(item.unitPrice),
          extendedPrice: formatCurrency(item.extendedPrice),
        })),
        totalAmount: formatCurrency(invoice.totalAmount),
      },
    });

    // Merge PrismCore if provided
    if (input.prismcorePath) {
      await pdfService.mergePrismCore(pdfPath, input.prismcorePath);
    }

    // Finalize in DB
    const finalized = await invoiceRepository.finalize(id, pdfPath, input.prismcorePath);

    // Record signer history (non-critical)
    const sigStaffIds = input.signatureStaffIds;
    if (sigStaffIds) {
      const entries = [
        { pos: 1, staffId: sigStaffIds.line1 },
        { pos: 2, staffId: sigStaffIds.line2 },
        { pos: 3, staffId: sigStaffIds.line3 },
      ].filter((e) => e.staffId);

      for (const entry of entries) {
        staffService.recordSignerHistory(id, invoice.staffId, entry.pos, entry.staffId!).catch(() => {});
      }
    }

    // Increment quick-pick usage (non-critical)
    const descriptions = invoice.items.map((i) => i.description);
    invoiceRepository.incrementQuickPickUsage(invoice.department, descriptions).catch(() => {});

    return toInvoiceResponse(finalized);
  },

  async getStats(filters: InvoiceFilters): Promise<InvoiceStatsResponse> {
    const { count, sum } = await invoiceRepository.countAndSum(filters);
    return { total: count, sumTotalAmount: sum };
  },
};
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/invoice/service.ts
git commit -m "feat: add invoice service with finalization, calculations, and PDF orchestration"
```

---

### Task 18: Invoice API Client & Hooks

**Files:**
- Create: `src/domains/invoice/api-client.ts`
- Create: `src/domains/invoice/hooks.ts`

- [ ] **Step 1: Create invoice API client**

```typescript
// src/domains/invoice/api-client.ts
import { ApiError } from "@/domains/shared/types";
import type {
  InvoiceResponse,
  CreateInvoiceInput,
  InvoiceFilters,
  FinalizeInput,
  InvoiceStatsResponse,
} from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

const BASE = "/api/invoices";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

function buildFilterParams(filters: InvoiceFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.staffId) params.set("staffId", filters.staffId);
  if (filters.department) params.set("department", filters.department);
  if (filters.category) params.set("category", filters.category);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.amountMin !== undefined) params.set("amountMin", String(filters.amountMin));
  if (filters.amountMax !== undefined) params.set("amountMax", String(filters.amountMax));
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  return params;
}

export const invoiceApi = {
  async list(filters: InvoiceFilters = {}): Promise<PaginatedResponse<InvoiceResponse>> {
    const params = buildFilterParams(filters);
    return request<PaginatedResponse<InvoiceResponse>>(`${BASE}?${params}`);
  },

  async getById(id: string): Promise<InvoiceResponse> {
    return request<InvoiceResponse>(`${BASE}/${id}`);
  },

  async create(input: CreateInvoiceInput): Promise<InvoiceResponse> {
    return request<InvoiceResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: Partial<CreateInvoiceInput>): Promise<InvoiceResponse> {
    return request<InvoiceResponse>(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },

  async finalize(id: string, input: FinalizeInput): Promise<InvoiceResponse> {
    return request<InvoiceResponse>(`${BASE}/${id}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getStats(filters: InvoiceFilters = {}): Promise<InvoiceStatsResponse> {
    const params = buildFilterParams(filters);
    params.set("statsOnly", "true");
    return request<InvoiceStatsResponse>(`${BASE}?${params}`);
  },

  async getPdf(id: string): Promise<Blob> {
    const res = await fetch(`${BASE}/${id}/pdf`);
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.blob();
  },

  async exportCsv(filters: InvoiceFilters = {}): Promise<Blob> {
    const params = buildFilterParams(filters);
    const res = await fetch(`${BASE}/export?${params}`);
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.blob();
  },
};
```

- [ ] **Step 2: Create invoice hooks**

```typescript
// src/domains/invoice/hooks.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { invoiceApi } from "./api-client";
import { handleApiError } from "@/domains/shared/errors";
import type { InvoiceResponse, InvoiceFilters, InvoiceStatsResponse } from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

export function useInvoices(filters: InvoiceFilters) {
  const [data, setData] = useState<PaginatedResponse<InvoiceResponse> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await invoiceApi.list(filters));
    } catch (e) {
      handleApiError(e, "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

export function useInvoice(id: string | null) {
  const [data, setData] = useState<InvoiceResponse | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await invoiceApi.getById(id));
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load invoice"));
      handleApiError(e, "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useInvoiceStats(filters: InvoiceFilters = {}) {
  const [data, setData] = useState<InvoiceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await invoiceApi.getStats(filters));
    } catch (e) {
      handleApiError(e, "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/domains/invoice/api-client.ts src/domains/invoice/hooks.ts
git commit -m "feat: add invoice API client and React hooks"
```

---

### Task 19: Refactor Invoice Routes

**Files:**
- Modify: `src/app/api/invoices/route.ts`
- Modify: `src/app/api/invoices/[id]/route.ts`
- Modify: `src/app/api/invoices/[id]/finalize/route.ts`
- Modify: `src/app/api/invoices/[id]/pdf/route.ts`
- Modify: `src/app/api/invoices/export/route.ts`

This is the largest refactoring task. Each route becomes a thin dispatcher delegating to `invoiceService`.

- [ ] **Step 1: Refactor main invoices route**

Replace `src/app/api/invoices/route.ts` with thin dispatcher using `withAuth` + `invoiceService`.list() and .create(). Parse query params from `req.nextUrl.searchParams`, call service, return `NextResponse.json()`. Use `invoiceCreateSchema.parse()` for POST validation. Handle statsOnly mode by calling `invoiceService.getStats()`.

- [ ] **Step 2: Refactor invoice detail route**

Replace `src/app/api/invoices/[id]/route.ts`. GET calls `invoiceService.getById()`. PUT calls `invoiceService.update()`. DELETE calls `invoiceService.delete()`. Extract `id` from `ctx.params`.

- [ ] **Step 3: Refactor finalize route**

Replace `src/app/api/invoices/[id]/finalize/route.ts`. POST calls `invoiceService.finalize(id, input)`. Remove all inline formatting functions, signature parsing, PDF orchestration — it's all in the service now.

- [ ] **Step 4: Refactor PDF route**

Replace `src/app/api/invoices/[id]/pdf/route.ts`. GET calls `invoiceService.getById()` for the pdfPath, then `pdfService.readPdf()` to stream the file.

- [ ] **Step 5: Refactor export route**

The CSV export route stays mostly the same but uses `invoiceService.list()` instead of direct Prisma queries. Keep the CSV building logic in the route (it's presentation-layer).

- [ ] **Step 6: Run all tests**

Run: `npx vitest run 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 7: Manual verification**

1. Create a new invoice with line items
2. Save as draft
3. Edit the draft
4. Finalize the invoice (with signatures)
5. Download the PDF
6. Delete an invoice
7. Check dashboard stats
8. Export CSV

- [ ] **Step 8: Commit**

```bash
git add src/app/api/invoices/
git commit -m "refactor: invoice routes as thin dispatchers using invoiceService"
```

---

### Task 20: Update Invoice Components to Use API Client

**Files:**
- Modify: `src/components/invoices/invoice-table.tsx`
- Modify: `src/components/dashboard/stats-cards.tsx`
- Modify: `src/components/dashboard/recent-invoices.tsx`
- Modify: `src/components/dashboard/pending-charges.tsx`
- Modify: `src/app/invoices/page.tsx`

- [ ] **Step 1: Update InvoiceTable**

Replace hardcoded `fetch("/api/invoices?...")` calls with `invoiceApi.list(filters)`. Replace CSV export fetch with `invoiceApi.exportCsv(filters)`. Import `InvoiceResponse` type from `@/domains/invoice/types` and remove the local interface.

- [ ] **Step 2: Update dashboard components**

Replace `StatsCards` fetch calls with `useInvoiceStats()` hook. Replace `RecentInvoices` fetch with `useInvoices()` hook. Replace `PendingCharges` fetch with `useInvoiceStats({ status: "PENDING_CHARGE", ... })`.

- [ ] **Step 3: Update invoices page**

In `src/app/invoices/page.tsx`, replace direct `prisma.staff.findMany` call with `staffService.list()` and `prisma.category.findMany` with a direct import (categories stay simple — no domain needed yet).

- [ ] **Step 4: Run tests and manual verification**

Run: `npx vitest run 2>&1 | tail -20`
Navigate through invoice list, dashboard, CSV export.

- [ ] **Step 5: Commit**

```bash
git add src/components/invoices/invoice-table.tsx src/components/dashboard/ src/app/invoices/page.tsx
git commit -m "refactor: invoice components use invoiceApi and domain hooks"
```

---

## Phase 5: Quote Domain

### Task 21: Quote Domain (Types, Repository, Service, API Client, Hooks)

**Files:**
- Create: `src/domains/quote/types.ts`
- Create: `src/domains/quote/repository.ts`
- Create: `src/domains/quote/service.ts`
- Create: `src/domains/quote/api-client.ts`
- Create: `src/domains/quote/hooks.ts`

Follow the same patterns established in the invoice domain. Key differences:

- `quoteRepository` queries `prisma.invoice` with `type: "QUOTE"` filter
- `quoteService.autoExpire()` checks `expirationDate` and transitions DRAFT/SENT quotes to EXPIRED
- `quoteService.convertToInvoice()` calls `invoiceService.create()` with the quote's data, then marks the quote as ACCEPTED
- `quoteService.generatePdf()` calls `pdfService.generateQuote()`
- Move `generateQuoteNumber()` from `src/lib/quote-number.ts` into `quoteRepository`

- [ ] **Step 1: Create quote types** (same pattern as invoice types)
- [ ] **Step 2: Create quote repository** (queries Invoice with type=QUOTE, includes auto-expiry query)
- [ ] **Step 3: Create quote service** (auto-expiry, conversion, PDF generation)
- [ ] **Step 4: Create quote API client and hooks**
- [ ] **Step 5: Commit**

```bash
git add src/domains/quote/
git commit -m "feat: add quote domain (types, repository, service, api-client, hooks)"
```

---

### Task 22: Refactor Quote Routes and Components

**Files:**
- Modify: `src/app/api/quotes/route.ts`
- Modify: `src/app/api/quotes/[id]/route.ts`
- Modify: `src/app/api/quotes/[id]/pdf/route.ts`
- Modify: `src/app/api/quotes/[id]/send/route.ts`
- Modify: `src/app/api/quotes/[id]/convert/route.ts`
- Modify: `src/app/quotes/page.tsx`

- [ ] **Step 1: Refactor all quote routes to thin dispatchers**
- [ ] **Step 2: Update quote components to use quoteApi**
- [ ] **Step 3: Update quotes page to use quoteService**
- [ ] **Step 4: Run tests and manual verification** (create, send, convert, delete quote)
- [ ] **Step 5: Commit**

```bash
git add src/app/api/quotes/ src/app/quotes/page.tsx
git commit -m "refactor: quote routes and components use quote domain"
```

---

## Phase 6: Admin & Analytics Domains

### Task 23: Admin Domain

**Files:**
- Create: `src/domains/admin/types.ts`
- Create: `src/domains/admin/repository.ts`
- Create: `src/domains/admin/service.ts`

- [ ] **Step 1: Create admin domain files**

`adminRepository`: wraps User CRUD, StaffAccountNumber CRUD, db-health queries.
`adminService`: username generation with collision detection, password hashing, role management.

- [ ] **Step 2: Refactor admin routes to thin dispatchers using withAdmin**
- [ ] **Step 3: Run tests and verify admin panel works**
- [ ] **Step 4: Commit**

```bash
git add src/domains/admin/ src/app/api/admin/
git commit -m "refactor: admin domain and routes as thin dispatchers"
```

---

### Task 24: Analytics Domain

**Files:**
- Create: `src/domains/analytics/types.ts`
- Create: `src/domains/analytics/repository.ts`
- Create: `src/domains/analytics/service.ts`

- [ ] **Step 1: Create analytics domain**

Move aggregation logic from the analytics route into `analyticsRepository` using DB-level groupBy queries instead of in-memory JS aggregation where possible.

- [ ] **Step 2: Refactor analytics route**
- [ ] **Step 3: Update analytics dashboard component if it uses raw fetch**
- [ ] **Step 4: Run tests and verify dashboard charts render**
- [ ] **Step 5: Commit**

```bash
git add src/domains/analytics/ src/app/api/analytics/
git commit -m "refactor: analytics domain with DB-level aggregations"
```

---

## Phase 7: Component Decomposition

### Task 25: Decompose useInvoiceForm

**Files:**
- Create: `src/components/invoice/hooks/use-invoice-form-state.ts`
- Create: `src/components/invoice/hooks/use-tax-calculation.ts`
- Create: `src/components/invoice/hooks/use-staff-autofill.ts`
- Create: `src/components/invoice/hooks/use-staff-auto-save.ts`
- Create: `src/components/invoice/hooks/use-invoice-save.ts`
- Modify: `src/components/invoice/invoice-form.tsx`

- [ ] **Step 1: Extract use-tax-calculation hook**

Pure computation hook — easiest to extract first.

```typescript
// src/components/invoice/hooks/use-tax-calculation.ts
"use client";
import { useMemo } from "react";
import { TAX_RATE } from "@/domains/invoice/constants";
import type { CreateLineItemInput } from "@/domains/invoice/types";

export function useTaxCalculation(items: CreateLineItemInput[]) {
  return useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
      0
    );
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    return { subtotal, tax, total: subtotal + tax };
  }, [items]);
}
```

- [ ] **Step 2: Extract use-invoice-form-state hook** (form state management with useState/useReducer)
- [ ] **Step 3: Extract use-staff-autofill hook** (staff selection → field population)
- [ ] **Step 4: Extract use-staff-auto-save hook** (debounced PATCH via staffApi)
- [ ] **Step 5: Extract use-invoice-save hook** (saveDraft, finalize, savePendingCharge via invoiceApi)
- [ ] **Step 6: Rewrite invoice-form.tsx as composition root** (~80 lines wiring the 5 hooks)
- [ ] **Step 7: Run tests and manual verification** (full invoice creation flow with keyboard mode)
- [ ] **Step 8: Commit**

```bash
git add src/components/invoice/hooks/ src/components/invoice/invoice-form.tsx
git commit -m "refactor: decompose useInvoiceForm into 5 focused hooks"
```

---

### Task 26: Decompose InvoiceDetailView

**Files:**
- Create: `src/components/invoices/invoice-detail-header.tsx`
- Create: `src/components/invoices/invoice-detail-info.tsx`
- Create: `src/components/invoices/invoice-detail-staff.tsx`
- Create: `src/components/invoices/invoice-detail-items.tsx`
- Modify: `src/components/invoices/invoice-detail.tsx`

- [ ] **Step 1: Extract presenter components** (pure props → render, no side effects)
- [ ] **Step 2: Rewrite invoice-detail.tsx as container** (~60 lines using useInvoice hook)
- [ ] **Step 3: Run tests and verify invoice detail page renders correctly**
- [ ] **Step 4: Commit**

```bash
git add src/components/invoices/
git commit -m "refactor: decompose InvoiceDetailView into container + 4 presenters"
```

---

### Task 27: Decompose InvoiceManager

**Files:**
- Create: `src/components/admin/hooks/use-invoice-manager.ts`
- Create: `src/components/admin/hooks/use-inline-edit.ts`
- Create: `src/components/admin/invoice-manager-table.tsx`
- Create: `src/components/admin/invoice-manager-filters.tsx`
- Modify: `src/components/admin/invoice-manager.tsx`

- [ ] **Step 1: Extract hooks and sub-components**
- [ ] **Step 2: Rewrite invoice-manager.tsx as container**
- [ ] **Step 3: Run tests and verify admin invoice manager works**
- [ ] **Step 4: Commit**

```bash
git add src/components/admin/
git commit -m "refactor: decompose InvoiceManager into container + table + filters + hooks"
```

---

### Task 28: Final Cleanup

**Files:**
- Remove or update any remaining local type duplicates
- Verify `src/lib/quote-number.ts` is no longer imported (moved to quote repository)

- [ ] **Step 1: Search for remaining raw fetch calls in components**

Run: `grep -rn 'fetch("/api/' src/components/ --include='*.tsx' --include='*.ts'`
Expected: No results (all replaced by domain api-clients)

- [ ] **Step 2: Search for remaining duplicate StaffMember interfaces**

Run: `grep -rn 'interface StaffMember' src/components/`
Expected: No results (all replaced by imports from staff/types.ts)

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 4: Run build**

Run: `npm run build 2>&1 | tail -30`
Expected: Build succeeds with no type errors

- [ ] **Step 5: Full E2E manual verification**

1. Login
2. Dashboard loads (stats, recent invoices, pending charges)
3. Create invoice with staff selection, line items, keyboard mode
4. Save draft, edit, finalize with signatures
5. Download PDF
6. Create quote, send, convert to invoice
7. Admin: manage users, account codes, invoice manager
8. Analytics dashboard renders charts
9. Staff directory: search, create, edit, deactivate

- [ ] **Step 6: Commit any cleanup**

```bash
git add -A
git commit -m "chore: final cleanup — remove duplicate types, dead imports, verify no raw fetch in components"
```
