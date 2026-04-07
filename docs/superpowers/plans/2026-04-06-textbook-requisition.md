# Textbook Requisition System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a textbook requisition workflow into LAPortal — a public faculty submission form and an authenticated internal management panel for all LAPortal users.

**Architecture:** Two Prisma models (`TextbookRequisition` + `RequisitionBook`) plus a `RequisitionNotification` audit table, following the domain-module pattern. A public rate-limited faculty form for submissions, and authenticated views for all LAPortal users to manage requisitions with status workflow and email notifications. Realtime updates via Supabase Realtime. Email via the existing `sendEmail()` helper (Power Automate webhook). Prisma migrations auto-create tables in the Portal's existing Supabase Postgres — no manual Supabase dashboard changes needed.

**Tech Stack:** Next.js App Router, Prisma 7 + Supabase Postgres, Tailwind CSS 4 + shadcn/ui v4 (base-ui), Zod v4, NextAuth.js, Power Automate email, Supabase Realtime, Vitest

---

## Access Model

### Public

- Faculty can access `/textbook-requisitions/submit`
- Faculty can submit a requisition without LAPortal authentication
- Public submission is rate-limited (IP-based, reuses `checkRateLimit()` from `src/lib/rate-limit.ts`)
- Public submission returns a narrow acknowledgment (not the full internal DTO)

### Authenticated LAPortal Users

- Any authenticated LAPortal user can access the requisition panel at `/textbook-requisitions`
- Any authenticated LAPortal user can view full requisition details including `staffNotes`
- Any authenticated LAPortal user can create, edit, delete, change status, and send instructor notification emails
- Requisition records are shared internal workflow data, not admin-only data

### Data Visibility

- Full requisition details (including `staffNotes`, audit fields, notification history) are visible to all authenticated LAPortal users
- The public faculty form never sees internal fields

---

## Skills to Invoke Per Phase

| Phase | Tasks | Skills to Invoke |
|---|---|---|
| Schema + Domain | 1-6 | `tdd`, `postgres-patterns`, `backend-patterns` |
| API Routes | 7 | `api-design`, `security-review` |
| UI Components + Pages | 8-13 | `frontend-design:frontend-design`, `vercel-react-best-practices`, `web-design-guidelines` |
| Verification + Polish | 14-15 | `e2e`, `simplify`, `superpowers:verification-before-completion`, `code-review:code-review` |

**Skill invocation rules:**
- Invoke `tdd` before writing any test in Tasks 3-5
- Invoke `postgres-patterns` during Task 1 (schema design) to validate indexing and enum decisions
- Invoke `security-review` after Task 7 API routes are written — public endpoint accepting user input
- Invoke `frontend-design:frontend-design` at the START of Task 9, before any component code
- Invoke `vercel-react-best-practices` alongside frontend-design for React/Next.js perf patterns
- Invoke `web-design-guidelines` for Task 13 (public faculty form) — accessibility is critical
- Invoke `e2e` after Task 14 to generate Playwright tests for public submission and internal workflows
- Invoke `code-review:code-review` as the final gate before PR

---

## File Structure

### New Files

```
prisma/
  migrations/<timestamp>_add_textbook_requisitions/migration.sql  (auto-generated)

src/domains/textbook-requisition/
  types.ts               — DTOs, input types, filter types, enums, acknowledgment type
  repository.ts          — Prisma queries (findMany, findById, create, update, delete, notification audit)
  service.ts             — Business logic, DTO mapping, realtime broadcast, email via sendEmail()
  api-client.ts          — Client-side typed fetch wrappers
  hooks.ts               — useRequisitions(), useRequisition() React hooks

src/lib/
  validators.ts          — (MODIFY) Add requisition + book Zod schemas

src/app/
  api/textbook-requisitions/
    route.ts             — GET (list, authenticated) + POST (create, authenticated)
    submit/route.ts      — POST (public faculty submission, rate-limited)
    [id]/route.ts        — GET + PUT + PATCH + DELETE (authenticated)
    [id]/notify/route.ts — POST (send status email, authenticated)
    export/route.ts      — GET (CSV export, authenticated)

  textbook-requisitions/
    page.tsx             — List page (authenticated, all users)
    [id]/page.tsx        — Detail page (authenticated, all users)
    [id]/edit/page.tsx   — Edit page (authenticated, all users)
    new/page.tsx         — Create page (authenticated, all users)
    submit/page.tsx      — Public faculty submission form (NO auth)

src/components/
  textbook-requisitions/
    requisition-table.tsx     — Filterable, sortable table with status badges
    requisition-filters.tsx   — Search, status, term, year filter bar
    requisition-detail.tsx    — Full detail view with books, audit trail, actions
    requisition-form.tsx      — Create/edit form (shared by create + edit pages)
    requisition-edit-view.tsx — Edit page wrapper (loads data, passes to form)
    requisition-create-view.tsx — Create page wrapper (empty form)
    requisition-books.tsx     — Book fieldset (add/remove up to 5)
    requisition-status-badge.tsx — Color-coded status pill
    requisition-stats.tsx     — Summary cards (total, pending, ordered, on-shelf, needs attention)
    faculty-submit-form.tsx   — Public form (standalone, no auth, different layout)
```

### Modified Files

```
prisma/schema.prisma                    — Add TextbookRequisition + RequisitionBook + RequisitionNotification models
src/lib/validators.ts                   — Add requisition Zod schemas
src/components/nav.tsx                  — Add "Requisitions" nav link
src/middleware.ts                       — Add public route exception for /textbook-requisitions/submit and /api/textbook-requisitions/submit ONLY
```

---

## Task 1: Prisma Schema — Models and Migration

> **Invoke skill:** `postgres-patterns` before writing schema — validate enum choices, indexing strategy, cascade rules, and audit field design.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and all three models**

Add at the end of `prisma/schema.prisma`:

```prisma
enum RequisitionStatus {
  PENDING
  ORDERED
  ON_SHELF
}

enum RequisitionSource {
  FACULTY_FORM
  STAFF_CREATED
}

enum BookBinding {
  HARDCOVER
  PAPERBACK
  LOOSE_LEAF
  DIGITAL
}

enum BookType {
  PHYSICAL
  OER
}

model TextbookRequisition {
  id                    String              @id @default(uuid())
  instructorName        String              @map("instructor_name")
  phone                 String
  email                 String
  department            String
  course                String
  sections              String
  enrollment            Int
  term                  String
  reqYear               Int                 @map("req_year")
  additionalInfo        String?             @map("additional_info")
  staffNotes            String?             @map("staff_notes")
  status                RequisitionStatus   @default(PENDING)
  source                RequisitionSource   @default(FACULTY_FORM)
  createdBy             String?             @map("created_by")
  lastStatusChangedAt   DateTime?           @map("last_status_changed_at")
  lastStatusChangedBy   String?             @map("last_status_changed_by")
  submittedAt           DateTime            @default(now()) @map("submitted_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  creator               User?               @relation("RequisitionCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  statusChanger         User?               @relation("RequisitionStatusChanger", fields: [lastStatusChangedBy], references: [id], onDelete: SetNull)
  books                 RequisitionBook[]
  notifications         RequisitionNotification[]

  @@index([status])
  @@index([term, reqYear])
  @@index([submittedAt])
  @@map("textbook_requisitions")
}

model RequisitionBook {
  id             String        @id @default(uuid())
  requisitionId  String        @map("requisition_id")
  bookNumber     Int           @map("book_number")
  author         String
  title          String
  isbn           String
  edition        String?
  copyrightYear  String?       @map("copyright_year")
  volume         String?
  publisher      String?
  binding        BookBinding?
  bookType       BookType      @default(PHYSICAL) @map("book_type")
  oerLink        String?       @map("oer_link")

  requisition TextbookRequisition @relation(fields: [requisitionId], references: [id], onDelete: Cascade)

  @@unique([requisitionId, bookNumber])
  @@map("requisition_books")
}

model RequisitionNotification {
  id              String   @id @default(uuid())
  requisitionId   String   @map("requisition_id")
  type            String
  recipientEmail  String   @map("recipient_email")
  subject         String
  success         Boolean
  sentBy          String   @map("sent_by")
  sentAt          DateTime @default(now()) @map("sent_at")
  errorMessage    String?  @map("error_message")

  requisition TextbookRequisition @relation(fields: [requisitionId], references: [id], onDelete: Cascade)
  sender      User                @relation("RequisitionNotificationSender", fields: [sentBy], references: [id], onDelete: Cascade)

  @@index([requisitionId, sentAt])
  @@map("requisition_notifications")
}
```

Also add the relation to the `User` model:

```prisma
// Add to User model's relation list:
requisitionsCreated          TextbookRequisition[]        @relation("RequisitionCreator")
requisitionsStatusChanged    TextbookRequisition[]        @relation("RequisitionStatusChanger")
requisitionNotificationsSent RequisitionNotification[]    @relation("RequisitionNotificationSender")
```

- [ ] **Step 2: Run the migration**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx prisma migrate dev --name add_textbook_requisitions
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 3: Verify the generated client**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx prisma generate
```

Expected: No errors. `TextbookRequisition`, `RequisitionBook`, and `RequisitionNotification` available.

- [ ] **Step 4: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add prisma/schema.prisma prisma/migrations/
git commit -m "$(cat <<'EOF'
feat: add TextbookRequisition, RequisitionBook, and RequisitionNotification models

Three new models for the textbook requisition system:
- TextbookRequisition: instructor info, course details, status workflow, audit fields
- RequisitionBook: up to 5 books per requisition with ISBN, binding, OER support
- RequisitionNotification: audit trail for email notifications (type, success, sentBy)
Includes indexes on status, term+year, and submittedAt.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Domain Types

**Files:**
- Create: `src/domains/textbook-requisition/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/domains/textbook-requisition/types.ts
import type { RequisitionStatus, RequisitionSource, BookBinding, BookType } from "@/generated/prisma/client";

// ── DTOs ──

export interface RequisitionBookResponse {
  id: string;
  bookNumber: number;
  author: string;
  title: string;
  isbn: string;
  edition: string | null;
  copyrightYear: string | null;
  volume: string | null;
  publisher: string | null;
  binding: BookBinding | null;
  bookType: BookType;
  oerLink: string | null;
}

export interface RequisitionNotificationResponse {
  id: string;
  type: string;
  recipientEmail: string;
  subject: string;
  success: boolean;
  sentByUserId: string;
  sentByName: string;
  sentAt: string;
  errorMessage: string | null;
}

export interface RequisitionResponse {
  id: string;
  instructorName: string;
  phone: string;
  email: string;
  department: string;
  course: string;
  sections: string;
  enrollment: number;
  term: string;
  reqYear: number;
  additionalInfo: string | null;
  staffNotes: string | null;
  status: RequisitionStatus;
  source: RequisitionSource;
  createdBy: string | null;
  creatorName: string | null;
  lastStatusChangedAt: string | null;
  lastStatusChangedByUserId: string | null;
  lastStatusChangedByName: string | null;
  submittedAt: string;
  updatedAt: string;
  books: RequisitionBookResponse[];
  notifications: RequisitionNotificationResponse[];
  attentionFlags: string[];
}

export interface RequisitionListResponse {
  requisitions: RequisitionResponse[];
  total: number;
  page: number;
  pageSize: number;
}

/** Narrow acknowledgment returned to the public faculty form */
export interface RequisitionSubmitAck {
  id: string;
  submittedAt: string;
  department: string;
  course: string;
  term: string;
  reqYear: number;
  bookCount: number;
}

// ── Input types ──

export interface CreateBookInput {
  bookNumber: number;
  author: string;
  title: string;
  isbn: string;
  edition?: string;
  copyrightYear?: string;
  volume?: string;
  publisher?: string;
  binding?: BookBinding | null;
  bookType?: BookType;
  oerLink?: string;
}

export interface CreateRequisitionInput {
  instructorName: string;
  phone: string;
  email: string;
  department: string;
  course: string;
  sections: string;
  enrollment: number;
  term: string;
  reqYear: number;
  additionalInfo?: string;
  staffNotes?: string;
  status?: RequisitionStatus;
  source?: RequisitionSource;
  books: CreateBookInput[];
}

export interface UpdateRequisitionInput {
  instructorName?: string;
  phone?: string;
  email?: string;
  department?: string;
  course?: string;
  sections?: string;
  enrollment?: number;
  term?: string;
  reqYear?: number;
  additionalInfo?: string | null;
  staffNotes?: string | null;
  status?: RequisitionStatus;
  books?: CreateBookInput[];
}

export interface StatusUpdateInput {
  status: RequisitionStatus;
}

// ── Filters ──

export interface RequisitionFilters {
  search?: string;
  status?: RequisitionStatus;
  term?: string;
  year?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ── Stats ──

export interface RequisitionStats {
  total: number;
  pending: number;
  ordered: number;
  onShelf: number;
  needsAttention: number;
}

// ── Re-exports for convenience ──

export type { RequisitionStatus, RequisitionSource, BookBinding, BookType };
```

- [ ] **Step 2: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/domains/textbook-requisition/types.ts
git commit -m "$(cat <<'EOF'
feat: add textbook requisition domain types

DTOs with audit fields and notification history, public submit acknowledgment
type, input types, filters, and stats. staffNotes replaces internalNotes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Zod Validation Schemas

> **Invoke skill:** `tdd` before writing tests — enforce test-first methodology throughout Tasks 3-5.

**Files:**
- Modify: `src/lib/validators.ts`
- Create: `tests/lib/requisition-validators.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/requisition-validators.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  requisitionBookSchema,
  requisitionCreateSchema,
  requisitionUpdateSchema,
  publicRequisitionSubmitSchema,
  requisitionStatusUpdateSchema,
} from "@/lib/validators";

describe("requisitionBookSchema", () => {
  it("should accept a valid book", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Intro to CS",
      isbn: "9781234567890",
    });
    expect(result.success).toBe(true);
  });

  it("should reject an ISBN that is not 10 or 13 digits", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Intro to CS",
      isbn: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("should accept ISBN-10 with X check digit", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Intro to CS",
      isbn: "012345678X",
    });
    expect(result.success).toBe(true);
  });

  it("should require oerLink when bookType is OER", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Open Resource",
      isbn: "9781234567890",
      bookType: "OER",
    });
    expect(result.success).toBe(false);
  });

  it("should accept OER book with oerLink", () => {
    const result = requisitionBookSchema.safeParse({
      bookNumber: 1,
      author: "Smith",
      title: "Open Resource",
      isbn: "9781234567890",
      bookType: "OER",
      oerLink: "https://example.com/oer",
    });
    expect(result.success).toBe(true);
  });
});

describe("requisitionCreateSchema", () => {
  const validInput = {
    instructorName: "Dr. Smith",
    phone: "(818) 555-1234",
    email: "smith@piercecollege.edu",
    department: "Computer Science",
    course: "CS 101",
    sections: "01, 02",
    enrollment: 35,
    term: "Fall",
    reqYear: 2026,
    books: [
      { bookNumber: 1, author: "Author", title: "Title", isbn: "9781234567890" },
    ],
  };

  it("should accept valid input", () => {
    const result = requisitionCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("should require at least one book", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, books: [] });
    expect(result.success).toBe(false);
  });

  it("should reject invalid term", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, term: "Autumn" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("should reject enrollment of zero", () => {
    const result = requisitionCreateSchema.safeParse({ ...validInput, enrollment: 0 });
    expect(result.success).toBe(false);
  });
});

describe("publicRequisitionSubmitSchema", () => {
  const validInput = {
    instructorName: "Dr. Smith",
    phone: "(818) 555-1234",
    email: "smith@piercecollege.edu",
    department: "Computer Science",
    course: "CS 101",
    sections: "01, 02",
    enrollment: 35,
    term: "Fall",
    reqYear: 2026,
    books: [
      { bookNumber: 1, author: "Author", title: "Title", isbn: "9781234567890" },
    ],
  };

  it("should strip status from public submissions", () => {
    const result = publicRequisitionSubmitSchema.safeParse({
      ...validInput,
      status: "ORDERED",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).status).toBeUndefined();
    }
  });

  it("should strip staffNotes from public submissions", () => {
    const result = publicRequisitionSubmitSchema.safeParse({
      ...validInput,
      staffNotes: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).staffNotes).toBeUndefined();
    }
  });

  it("should strip source from public submissions", () => {
    const result = publicRequisitionSubmitSchema.safeParse({
      ...validInput,
      source: "STAFF_CREATED",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).source).toBeUndefined();
    }
  });
});

describe("requisitionStatusUpdateSchema", () => {
  it("should accept valid status", () => {
    const result = requisitionStatusUpdateSchema.safeParse({ status: "ORDERED" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const result = requisitionStatusUpdateSchema.safeParse({ status: "CANCELLED" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx vitest run tests/lib/requisition-validators.test.ts
```

Expected: FAIL — schemas not found in `@/lib/validators`.

- [ ] **Step 3: Add schemas to validators.ts**

Append to `src/lib/validators.ts`:

```typescript
// ── Textbook Requisitions ─────────────────────────────────────────────────

const isbnRegex = /^[0-9Xx]{10}$|^[0-9]{13}$/;

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "");
}

export const requisitionBookSchema = z.object({
  bookNumber: z.number().int().min(1).max(5),
  author: z.string().min(1, "Author is required"),
  title: z.string().min(1, "Title is required"),
  isbn: z
    .string()
    .min(1, "ISBN is required")
    .transform(normalizeIsbn)
    .pipe(z.string().regex(isbnRegex, "ISBN must be 10 or 13 digits")),
  edition: z.string().optional(),
  copyrightYear: z.string().optional(),
  volume: z.string().optional(),
  publisher: z.string().optional(),
  binding: z.enum(["HARDCOVER", "PAPERBACK", "LOOSE_LEAF", "DIGITAL"]).nullable().optional(),
  bookType: z.enum(["PHYSICAL", "OER"]).default("PHYSICAL"),
  oerLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.bookType === "OER" && !data.oerLink?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["oerLink"],
      message: "OER link is required when book type is OER",
    });
  }
});

export const requisitionCreateSchema = z.object({
  instructorName: z.string().min(1, "Instructor name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email is required"),
  department: z.string().min(1, "Department is required"),
  course: z.string().min(1, "Course is required"),
  sections: z.string().min(1, "Section(s) is required"),
  enrollment: z.number().int().positive("Enrollment must be a positive number"),
  term: z.enum(["Winter", "Spring", "Summer", "Fall"], {
    errorMap: () => ({ message: "Term must be Winter, Spring, Summer, or Fall" }),
  }),
  reqYear: z.number().int().min(2020).max(2099),
  additionalInfo: z.string().optional(),
  staffNotes: z.string().optional(),
  status: z.enum(["PENDING", "ORDERED", "ON_SHELF"]).optional(),
  source: z.enum(["FACULTY_FORM", "STAFF_CREATED"]).optional(),
  books: z.array(requisitionBookSchema).min(1, "At least one book is required").max(5),
});

export const requisitionUpdateSchema = requisitionCreateSchema.partial().extend({
  books: z.array(requisitionBookSchema).min(1).max(5).optional(),
});

export const requisitionStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "ORDERED", "ON_SHELF"]),
});

/** Public form: strips fields that only authenticated users should set */
export const publicRequisitionSubmitSchema = requisitionCreateSchema.omit({
  status: true,
  source: true,
  staffNotes: true,
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx vitest run tests/lib/requisition-validators.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/lib/validators.ts tests/lib/requisition-validators.test.ts
git commit -m "$(cat <<'EOF'
feat: add Zod validation schemas for textbook requisitions

Includes requisitionBookSchema with ISBN normalization/validation and OER
conditional logic, plus create/update/status-update/public-submit schemas.
Public submit strips status, source, and staffNotes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Repository Layer

> **Invoke skill:** `backend-patterns` — follow repository pattern with Prisma. TDD skill already active from Task 3.

**Files:**
- Create: `src/domains/textbook-requisition/repository.ts`
- Create: `tests/domains/textbook-requisition/repository.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domains/textbook-requisition/repository.test.ts`. Tests should cover:
- `findMany` with default pagination (page 1, size 20)
- `findMany` with status filter
- `findMany` with search across instructor, department, course, book author/title/isbn
- `findById` returns requisition with books and notifications
- `create` with nested books
- `update` with book replacement (transaction: delete old books, create new)
- `updateStatus` sets status + audit fields (lastStatusChangedAt, lastStatusChangedBy)
- `deleteById` cascade
- `countByStatus` returns correct counts
- `getDistinctYears` returns sorted years
- `createNotification` stores notification audit record

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx vitest run tests/domains/textbook-requisition/repository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repository**

Create `src/domains/textbook-requisition/repository.ts`. Key implementation details:

- `includeAll` shape: `{ books: { orderBy: { bookNumber: "asc" } }, notifications: { orderBy: { sentAt: "desc" } }, creator: { select: { id: true, name: true } } }`
- `buildWhere()`: handles search, status, term, year filters. Search scans: instructorName, email, department, course, sections, phone, additionalInfo, staffNotes, books (author, title, isbn, publisher)
- `ALLOWED_SORT_FIELDS`: submittedAt, updatedAt, instructorName, department, course, status, term, reqYear
- `findMany()`: paginated with `$transaction([findMany, count])`
- `findById()`: single with `includeAll`
- `create()`: nested `books.create`
- `update()`: if books provided, `$transaction([deleteMany books, update with nested create])`; otherwise plain update
- `updateStatus()`: sets `status`, `lastStatusChangedAt: new Date()`, `lastStatusChangedBy: userId`
- `deleteById()`: cascade via DB constraint
- `countByStatus()`: `$transaction` of 4 counts (pending, ordered, on_shelf, total)
- `getDistinctYears()`: `findMany` with `distinct: ["reqYear"]`, `orderBy: { reqYear: "desc" }`
- `createNotification()`: `prisma.requisitionNotification.create()`
- `countNeedingAttention()`: loads all PENDING requisitions with books only (not ORDERED/ON_SHELF), computes attention flags server-side, returns count. This is bounded by the active pipeline size — a college bookstore will have at most dozens of pending requisitions per term, so loading them is acceptable. If the dataset grows, this can be replaced with a materialized flag column later.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx vitest run tests/domains/textbook-requisition/repository.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/domains/textbook-requisition/repository.ts tests/domains/textbook-requisition/repository.test.ts
git commit -m "$(cat <<'EOF'
feat: add textbook requisition repository layer

Prisma wrapper with paginated list, full-text search, status/term/year filters,
nested book create/replace, status update with audit fields, notification audit
records, and server-side needsAttention count.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Service Layer

**Files:**
- Create: `src/domains/textbook-requisition/service.ts`
- Create: `tests/domains/textbook-requisition/service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domains/textbook-requisition/service.test.ts`. Tests should cover:
- `list()` maps DB records to DTOs with ISO date strings and computed attention flags
- `getById()` returns null for missing records
- `create()` broadcasts `requisition-changed` realtime event
- `create()` sets `createdBy` from userId parameter
- `submitPublic()` returns narrow `RequisitionSubmitAck` (not full DTO)
- `submitPublic()` forces `source: FACULTY_FORM`, `status: PENDING`
- `update()` broadcasts realtime event
- `updateStatus()` passes userId for audit trail, broadcasts realtime event
- `delete()` broadcasts realtime event
- `sendNotification()` calls `sendEmail()` with correct subject/body, records audit via `createNotification()`, updates status
- `sendNotification()` records failure when `sendEmail()` returns false
- `getStats()` returns proper `needsAttention` count (not hardcoded 0)
- Attention flags: missing author/title/isbn, invalid ISBN length, OER without link, duplicate ISBN, duplicate title

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx vitest run tests/domains/textbook-requisition/service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `src/domains/textbook-requisition/service.ts`. Key implementation details:

- Import `sendEmail` from `@/lib/email` (not inline fetch)
- Import `safePublishAll` from `@/lib/sse`
- `computeAttentionFlags()`: checks incomplete books, invalid ISBN (not 10/13 after stripping), OER without link, duplicate ISBN, duplicate title
- `toResponse()`: maps DB record to `RequisitionResponse` DTO, converts dates to ISO strings, attaches `creatorName` from `creator.name`
- `toSubmitAck()`: maps DB record to narrow `RequisitionSubmitAck`
- `broadcastChange()`: `safePublishAll({ type: "requisition-changed" })`
- `list()`, `getById()`: standard DTO mapping
- `create(input, userId)`: sets `createdBy: userId`, calls `repository.create()`, broadcasts
- `submitPublic(input)`: forces `source: "FACULTY_FORM"`, `status: "PENDING"`, `createdBy: null`, returns `toSubmitAck()`
- `update(id, input)`: calls `repository.update()`, broadcasts
- `updateStatus(id, status, userId)`: calls `repository.updateStatus(id, status, userId)`, broadcasts
- `delete(id)`: calls `repository.deleteById()`, broadcasts
- `sendNotification(id, emailType, userId)`: loads requisition, builds email subject/body, calls `sendEmail()`, records notification via `repository.createNotification()` (with `success: true/false`). On success: updates status via `updateStatus()`, returns `{ requisition: RequisitionResponse, emailSent: true }`. On email failure: still records the notification with `success: false` and the error message, does NOT change status, returns `{ requisition: RequisitionResponse, emailSent: false, error: "Email delivery failed" }`. This lets the UI show a meaningful failure toast while preserving the audit trail.
- `getStats()`: calls `repository.countByStatus()` + `repository.countNeedingAttention()`
- Email templates match the Pierce Store versions:
  - "ordered": subject `Your Textbook Order Has Been Placed - {dept} {course}`, body lists books, signed Pierce College Bookstore
  - "on-shelf": subject `Your Textbooks Are Now Available - {dept} {course}`, body lists books, tells students to purchase

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx vitest run tests/domains/textbook-requisition/service.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/domains/textbook-requisition/service.ts tests/domains/textbook-requisition/service.test.ts
git commit -m "$(cat <<'EOF'
feat: add textbook requisition service layer

DTO mapping, attention flag computation, realtime broadcast on mutations,
status transitions with audit trail, email notifications via sendEmail()
helper with notification audit records. Public submit returns narrow ack.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: API Client + Hooks

**Files:**
- Create: `src/domains/textbook-requisition/api-client.ts`
- Create: `src/domains/textbook-requisition/hooks.ts`

- [ ] **Step 1: Create the API client**

Create `src/domains/textbook-requisition/api-client.ts`. Key details:

- `BASE = "/api/textbook-requisitions"`
- `request<T>()` helper with `cache: "no-store"` for GET, `ApiError.fromResponse` for errors
- `list(filters)`: GET with filter params
- `getById(id)`: GET `${BASE}/${id}`
- `create(input)`: POST to `BASE`
- `submitPublic(input)`: POST to `${BASE}/submit` — separate endpoint, returns `RequisitionSubmitAck`
- `update(id, input)`: PUT `${BASE}/${id}`
- `updateStatus(id, status)`: PATCH `${BASE}/${id}`
- `delete(id)`: DELETE `${BASE}/${id}`
- `sendNotification(id, emailType)`: POST `${BASE}/${id}/notify`
- `getStats()`: GET `${BASE}?statsOnly=true`
- `getDistinctYears()`: GET `${BASE}?yearsOnly=true`
- `exportCsv(filters)`: GET `${BASE}/export?${params}`, returns `Blob`

- [ ] **Step 2: Create the hooks**

Create `src/domains/textbook-requisition/hooks.ts`. Key details:

- `useRequisitions(initialFilters)`: state for data/loading/error/filters, `useSSE("requisition-changed", refetch)`
- `useRequisition(id)`: single record, same SSE pattern
- `useRequisitionStats()`: stats with SSE auto-refresh

- [ ] **Step 3: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/domains/textbook-requisition/api-client.ts src/domains/textbook-requisition/hooks.ts
git commit -m "$(cat <<'EOF'
feat: add textbook requisition API client and React hooks

Typed fetch wrappers for all requisition operations including separate
public submit endpoint. Hooks with Supabase Realtime auto-refresh.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: API Routes

> **Invoke skills:** `api-design` (REST patterns, status codes) + `security-review` after routes are written (public endpoint accepting user input — validate OWASP Top 10, rate limiting, input sanitization).

**Files:**
- Create: `src/app/api/textbook-requisitions/route.ts`
- Create: `src/app/api/textbook-requisitions/submit/route.ts`
- Create: `src/app/api/textbook-requisitions/[id]/route.ts`
- Create: `src/app/api/textbook-requisitions/[id]/notify/route.ts`
- Create: `src/app/api/textbook-requisitions/export/route.ts`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update middleware — narrow exception for public submit only**

In `src/middleware.ts`, update the matcher to exempt ONLY the public submit surfaces:

```typescript
export const config = {
  matcher: [
    "/((?!login|pricing-calculator|textbook-requisitions/submit|api/auth|api/internal|api/setup|api/print-pricing|api/quotes/public|api/textbook-requisitions/submit|api/version|quotes/review/[^/]+$|quotes/payment/[^/]+$|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
```

This exempts `/textbook-requisitions/submit` (page) and `/api/textbook-requisitions/submit` (API) only. All other requisition routes remain auth-protected by middleware.

- [ ] **Step 2: Create the public submit route (rate-limited)**

Create `src/app/api/textbook-requisitions/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { publicRequisitionSubmitSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit by IP: 10 submissions per 15 minutes
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateResult = await checkRateLimit(`requisition-submit:${ip}`, {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateResult.retryAfterMs ?? 0) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = publicRequisitionSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ack = await requisitionService.submitPublic(parsed.data);
    return NextResponse.json(ack, { status: 201 });
  } catch (error) {
    console.error("[textbook-requisitions/submit] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create the authenticated list + create route**

Create `src/app/api/textbook-requisitions/route.ts`. Uses `withAuth` (not `withAdmin`):

- `GET`: parses filter params, handles `statsOnly=true` and `yearsOnly=true` branches, returns paginated list
- `POST`: validates with `requisitionCreateSchema`, sets `source: "STAFF_CREATED"`, passes `session.user.id` as `createdBy`

- [ ] **Step 4: Create the single-resource route**

Create `src/app/api/textbook-requisitions/[id]/route.ts`. All use `withAuth` (not `withAdmin`):

- `GET`: returns full requisition DTO, 404 if not found
- `PUT`: validates with `requisitionUpdateSchema`, calls `service.update()`
- `PATCH`: validates with `requisitionStatusUpdateSchema`, calls `service.updateStatus()` with `session.user.id` for audit
- `DELETE`: calls `service.delete()`, returns `{ success: true }`

- [ ] **Step 5: Create the notification route (thin dispatcher)**

Create `src/app/api/textbook-requisitions/[id]/notify/route.ts`. Uses `withAuth`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import type { AuthSession } from "@/domains/shared/types";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withAuth(async (req: NextRequest, session: AuthSession, ctx?: RouteContext) => {
  const { id } = await ctx!.params;
  const body = await req.json();
  const emailType = body.emailType as "ordered" | "on-shelf";

  if (!["ordered", "on-shelf"].includes(emailType)) {
    return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
  }

  try {
    // Service owns: load requisition, build email, send via sendEmail(),
    // record notification audit, update status (only on success), broadcast realtime
    const result = await requisitionService.sendNotification(id, emailType, session.user.id);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // result is { requisition, emailSent, error? }
    // 200 even on email failure — the notification was recorded, status just wasn't changed
    // UI reads emailSent to show success toast vs. failure toast
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
```

- [ ] **Step 6: Create the CSV export route**

Create `src/app/api/textbook-requisitions/export/route.ts`. Uses `withAuth`. Reuses `buildCsv` from `src/lib/csv.ts`:

- Exports one row per book (requisition metadata repeated per book row)
- Headers: Submitted, Updated, Instructor, Phone, Email, Department, Course, Sections, Enrollment, Term, Year, Status, Source, Staff Notes, Book #, Author, Title, ISBN, Edition, Publisher, Binding, Type, OER Link
- Uses `buildCsv(headers, rows)` — no local CSV escaping logic

- [ ] **Step 7: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/app/api/textbook-requisitions/ src/middleware.ts
git commit -m "$(cat <<'EOF'
feat: add textbook requisition API routes

- POST /api/textbook-requisitions/submit (public, rate-limited)
- GET/POST /api/textbook-requisitions (authenticated, all users)
- GET/PUT/PATCH/DELETE /api/textbook-requisitions/[id] (authenticated)
- POST /api/textbook-requisitions/[id]/notify (authenticated, thin dispatcher)
- GET /api/textbook-requisitions/export (authenticated, CSV with book data)
Middleware narrowly exempts only /submit routes for public access.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Navbar Integration

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Add the Requisitions link**

In `src/components/nav.tsx`, add to the `links` array at line 38:

```typescript
const links: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/quotes", label: "Quotes" },
  { href: "/textbook-requisitions", label: "Requisitions", matchPrefix: "/textbook-requisitions" },
  { href: "/calendar", label: "Calendar" },
  { href: "/staff", label: "Staff" },
  { href: "/quick-picks", label: "Quick Picks" },
  { href: "/analytics", label: "Analytics" },
];
```

This is visible to all authenticated users (not admin-gated).

- [ ] **Step 2: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/components/nav.tsx
git commit -m "$(cat <<'EOF'
feat: add Requisitions to navbar

Visible to all authenticated users between Quotes and Calendar.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: UI Components — Status Badge, Stats, Filters

> **Invoke skills:** `frontend-design:frontend-design` at the START of this task — let it guide all component design from here through Task 13. Also invoke `vercel-react-best-practices` for React/Next.js performance patterns.

**Files:**
- Create: `src/components/textbook-requisitions/requisition-status-badge.tsx`
- Create: `src/components/textbook-requisitions/requisition-stats.tsx`
- Create: `src/components/textbook-requisitions/requisition-filters.tsx`

- [ ] **Step 1: Create the status badge**

Color-coded pill: Pending (amber), Ordered (blue), On Shelf (green). Uses `cn()` from utils.

- [ ] **Step 2: Create the stats cards**

Four stat cards (Total, Pending, Ordered, On Shelf) plus a Needs Attention card. Uses `useRequisitionStats()` hook. Realtime-refreshed.

- [ ] **Step 3: Create the filter bar**

Search input, Status dropdown, Term dropdown, Year dropdown (dynamically populated from `getDistinctYears()`), Clear button.

- [ ] **Step 4: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/components/textbook-requisitions/
git commit -m "$(cat <<'EOF'
feat: add requisition UI components — status badge, stats, filters

Color-coded status badges, summary stat cards with realtime updates
and needsAttention count, filterable search bar with status/term/year.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: UI Components — Table and Detail View

**Files:**
- Create: `src/components/textbook-requisitions/requisition-table.tsx`
- Create: `src/components/textbook-requisitions/requisition-detail.tsx`

- [ ] **Step 1: Create the table**

Sortable columns: Submitted, Instructor, Department, Course (term + year below), Status badge, Source, Books count, Attention flag count. Pagination. Each row links to detail page. Uses `useRequisitions()` hook for data + realtime.

- [ ] **Step 2: Create the detail view**

Full instructor info, per-book detail tables, staff notes, additional info, notification history table (from `notifications` on the DTO), attention flags. Action buttons: Edit, Mark Ordered + Email, Mark On-Shelf + Email, Delete (with Dialog confirmation). Toast feedback via sonner.

- [ ] **Step 3: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/components/textbook-requisitions/requisition-table.tsx src/components/textbook-requisitions/requisition-detail.tsx
git commit -m "$(cat <<'EOF'
feat: add requisition table and detail view components

Sortable paginated table with realtime refresh. Detail view with book tables,
notification audit history, attention flags, and status workflow actions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: UI Components — Form and Book Fieldset

**Files:**
- Create: `src/components/textbook-requisitions/requisition-books.tsx`
- Create: `src/components/textbook-requisitions/requisition-form.tsx`
- Create: `src/components/textbook-requisitions/requisition-edit-view.tsx`
- Create: `src/components/textbook-requisitions/requisition-create-view.tsx`

- [ ] **Step 1: Create the book fieldset**

Manages array of 1-5 books. Book 1 always visible. "Add Another Title" reveals next slot. Remove button clears and hides. Fields: Author, Title, ISBN (validation feedback), Edition, Copyright, Volume, Publisher, Binding (select), Type (select: Physical/OER), OER Link (conditional).

- [ ] **Step 2: Create the shared form component**

`RequisitionForm` accepts `initialData` prop (for edit), `onSubmit` callback, `isEdit` flag. Instructor info in 2-column grid. Book fieldset. Additional info textarea. Staff notes textarea. Status select (edit mode only). Submit + Cancel buttons.

- [ ] **Step 3: Create edit view wrapper**

`RequisitionEditView` loads requisition via `useRequisition(id)`, shows loading state, passes data to `RequisitionForm` with `isEdit: true`. On submit, calls `requisitionApi.update()`, redirects to detail page.

- [ ] **Step 4: Create view wrapper**

`RequisitionCreateView` renders `RequisitionForm` with empty initial state, `isEdit: false`. On submit, calls `requisitionApi.create()`, redirects to list page.

- [ ] **Step 5: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/components/textbook-requisitions/requisition-books.tsx src/components/textbook-requisitions/requisition-form.tsx src/components/textbook-requisitions/requisition-edit-view.tsx src/components/textbook-requisitions/requisition-create-view.tsx
git commit -m "$(cat <<'EOF'
feat: add requisition form, book fieldset, and page wrapper components

Reusable form for create/edit with dynamic 1-5 book slots, ISBN validation,
OER conditional fields. Separate edit and create view wrappers.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Pages — List, Detail, Edit, Create

**Files:**
- Create: `src/app/textbook-requisitions/page.tsx`
- Create: `src/app/textbook-requisitions/[id]/page.tsx`
- Create: `src/app/textbook-requisitions/[id]/edit/page.tsx`
- Create: `src/app/textbook-requisitions/new/page.tsx`

- [ ] **Step 1: Create the list page**

Server component. `getServerSession` + `redirect("/login")`. Renders `RequisitionStats` + `RequisitionTable`. "New Requisition" button links to `/textbook-requisitions/new`.

- [ ] **Step 2: Create the detail page**

Server component. Auth check. Renders `RequisitionDetail` with `id` from params.

- [ ] **Step 3: Create the edit page**

Server component. Auth check. Renders `RequisitionEditView` with `id` from params.

- [ ] **Step 4: Create the create page**

Server component. Auth check. Renders `RequisitionCreateView`.

- [ ] **Step 5: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/app/textbook-requisitions/
git commit -m "$(cat <<'EOF'
feat: add requisition pages — list, detail, edit, create

Server components with auth checks. All authenticated users can access
all pages. No admin-only restrictions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Public Faculty Submission Page

> **Invoke skill:** `web-design-guidelines` — accessibility audit for the public form. Ensure proper labels, focus management, error announcements, and mobile responsiveness.

**Files:**
- Create: `src/app/textbook-requisitions/submit/page.tsx`
- Create: `src/components/textbook-requisitions/faculty-submit-form.tsx`

- [ ] **Step 1: Create the public page**

Server component. NO auth check. Renders page header (Pierce College branding) + `FacultySubmitForm`.

- [ ] **Step 2: Create the faculty form component**

Client component. Standalone — does NOT require auth. Reuses `RequisitionBooks` fieldset. Own instructor info fields, term/year selects, additional notes textarea. On submit calls `requisitionApi.submitPublic()`. Shows success confirmation with the `RequisitionSubmitAck` details. Shows validation errors inline. Double-submit protection (`submitting` state disables button). Accessible: proper `<label>` associations, `aria-describedby` for errors, `aria-live="polite"` for success/error messages, logical tab order.

Nav renders in the root layout but gracefully returns null for unauthenticated visitors.

- [ ] **Step 3: Commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add src/app/textbook-requisitions/submit/page.tsx src/components/textbook-requisitions/faculty-submit-form.tsx
git commit -m "$(cat <<'EOF'
feat: add public faculty textbook requisition submission page

No-auth form at /textbook-requisitions/submit for instructors.
Reuses book fieldset, accessible design, double-submit protection.
Returns narrow acknowledgment on success.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Ship Check and Final Verification

> **Invoke skills:** `superpowers:verification-before-completion` (evidence before assertions), then `simplify` (review for reuse and quality).

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx vitest run --dir tests && npx vitest run --dir src/__tests__
```

Expected: All tests pass including new requisition tests.

- [ ] **Step 2: Run ship-check**

```bash
cd /Users/montalvo/lapc-invoice-maker
npm run ship-check
```

Expected: Lint + build + tests all pass.

- [ ] **Step 3: Fix any issues found**

Address any type errors, lint warnings, or test failures.

- [ ] **Step 4: Commit if needed**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add -A
git commit -m "$(cat <<'EOF'
fix: address ship-check issues in textbook requisition feature

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: E2E Tests + Code Review

> **Invoke skills:** `e2e` (generate Playwright tests for critical flows), then `code-review:code-review` (final gate before PR).
>
> **Prerequisite:** This repo does not currently have Playwright installed. The `e2e` skill must install and configure Playwright as part of this task (`npm install -D @playwright/test && npx playwright install`), create `playwright.config.ts`, and add a `test:e2e` script to `package.json`. If the `e2e` skill does not handle setup, do it manually before writing tests.

- [ ] **Step 0: Install and configure Playwright (if not already present)**

```bash
cd /Users/montalvo/lapc-invoice-maker
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts` with `baseURL: "http://localhost:3000"`, `webServer` pointing to `npm run dev`.

- [ ] **Step 1: Generate E2E tests**

Critical flows to cover:
- Public faculty form: fill all fields, add 2 books, submit, see confirmation with ack details
- Public faculty form: submit with missing required fields, see validation errors
- Public faculty form: submit 11 times rapidly, get 429 rate limit on the 11th
- Authenticated list: load page, verify stats cards including needsAttention, filter by status, search
- Authenticated detail: view requisition, see notification history, click "Mark Ordered + Email", verify status change and new notification record
- Authenticated create: fill form, verify staffNotes field is available, submit
- Authenticated CSV export: click export, verify download includes book data

- [ ] **Step 2: Run E2E tests**

```bash
cd /Users/montalvo/lapc-invoice-maker
npx playwright test --grep "requisition"
```

Expected: All E2E tests pass.

- [ ] **Step 3: Code review**

Review all files in:
- `src/domains/textbook-requisition/`
- `src/app/api/textbook-requisitions/`
- `src/components/textbook-requisitions/`
- `src/app/textbook-requisitions/`
- Changes to `src/middleware.ts`, `src/lib/validators.ts`, `src/components/nav.tsx`

Fix any CRITICAL or HIGH issues.

- [ ] **Step 4: Final commit**

```bash
cd /Users/montalvo/lapc-invoice-maker
git add .
git commit -m "$(cat <<'EOF'
test: add E2E tests and address code review findings

Playwright coverage for public submission (including rate limiting) and
authenticated workflows. Code review fixes applied.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Summary of Changes from Critique

| Critique Point | Resolution |
|---|---|
| 1. Wrong product boundary ("admin") | Rewritten throughout: "authenticated internal panel for all users" |
| 2. Inconsistent permissions | All routes use `withAuth`, not `withAdmin`. Shared operational data. |
| 3. No abuse protection on public submit | Rate limiting via `checkRateLimit()` — 10 per 15min per IP |
| 4. Public + internal overloaded in one route | Split: `/api/textbook-requisitions/submit` (public) vs `/api/textbook-requisitions` (authenticated) |
| 5. Middleware too broad | Narrowed to exempt only `/textbook-requisitions/submit` and `/api/textbook-requisitions/submit` |
| 6. Email bypasses existing helpers | Service uses `sendEmail()` from `src/lib/email.ts`. Route is a thin dispatcher. |
| 7. No audit trail | Added `createdBy`, `lastStatusChangedAt/By` on requisition + `RequisitionNotification` table with User relations |
| 8. `internalNotes` misleading | Renamed to `staffNotes` |
| 9. Public submit returns full DTO | Returns narrow `RequisitionSubmitAck` (id, submittedAt, dept, course, term, year, bookCount) |
| 10. `needsAttention` hardcoded to 0 | Implemented server-side via `countNeedingAttention()` on PENDING requisitions only |
| 11. CSV drops book data | One row per book, uses `buildCsv()` from `src/lib/csv.ts` |
| 12. Duplicate CSV escaping | Reuses existing `buildCsv()` helper |
| 13. Component references undefined | Added explicit `requisition-edit-view.tsx` and `requisition-create-view.tsx` wrapper components |
| 14. Skill references | All referenced skills verified available in session |

## Codex Review Findings (addressed)

| Finding | Resolution |
|---|---|
| `ADMIN_CREATED` is wrong domain term | Renamed to `STAFF_CREATED` throughout schema, types, and route logic |
| Audit fields not human-readable | Added Prisma User relations on `lastStatusChangedBy` and notification `sentBy`; DTOs expose both `*UserId` and `*Name` fields |
| Notification failure response underspecified | Service returns `{ requisition, emailSent: boolean, error?: string }`. Route returns 200 on email failure (failure was audited), UI reads `emailSent` for toast behavior |
| `needsAttention` may be expensive | Scoped to PENDING requisitions only (bounded by active pipeline). Note added about future materialization if needed |
| Playwright not installed in repo | Task 15 now has explicit Step 0 for Playwright installation and config setup |

## Database Changes Summary

**New enums:** `RequisitionStatus`, `RequisitionSource`, `BookBinding`, `BookType`

**New tables:**
- `textbook_requisitions` — instructor info, course details, status, audit fields (createdBy, lastStatusChangedAt/By), timestamps
- `requisition_books` — 1-5 books per requisition, unique on (requisition_id, book_number), cascade delete
- `requisition_notifications` — email audit trail (type, recipient, success, sentBy, errorMessage)

**Indexes:** status, term+year, submittedAt, requisitionId+sentAt

**Improvements over Pierce version:**
- `enrollment` is `Int` (was text), `reqYear` is `Int` (was text)
- Proper Prisma enums (not freeform text)
- Server-side Zod validation (Pierce only had client-side)
- No exposed Supabase keys — all queries through authenticated API routes
- Rate-limited public endpoint (Pierce had CAPTCHA only)
- Full notification audit trail (Pierce had no audit)
- Email via existing `sendEmail()` helper (not inline CDO)
