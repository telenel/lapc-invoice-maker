# Document Deletion Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace destructive quote and invoice deletion with a recoverable Deleted Archive that owners and admins can use to archive and restore documents at any time.

**Architecture:** Use soft-delete semantics on the shared `Invoice` model, but align the internal field names to the repo’s existing archive convention: `archivedAt` / `archivedBy` instead of the first-pass spec’s `deletedAt` / `deletedBy`. Keep archive/restore write logic in the `invoice` and `quote` domains, add a small cross-document `archive` domain for list/restore UI, and reuse the existing detail pages with archived read-only banners and restore actions.

**Tech Stack:** Prisma 7 (migration + generated client), Next.js 14 App Router (route handlers + pages), Vitest (domain/API/component tests), Playwright (archive/restore regression), shadcn/ui dialogs/tables, existing domain-module architecture.

**Spec:** `docs/superpowers/specs/2026-04-13-document-deletion-archive-design.md`

---

## Task 1: Prisma Archive Fields + Shared Archive DTOs

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDD_add_invoice_archive_fields/migration.sql`
- Modify: `src/domains/invoice/types.ts`
- Modify: `src/domains/quote/types.ts`
- Create: `src/domains/archive/types.ts`

- [ ] **Step 1: Update the Prisma schema to add archive fields on `Invoice`**

In `prisma/schema.prisma`, add archive fields and a named relation on `Invoice`, plus the reverse relation on `User`:

```prisma
model User {
  id               String    @id @default(uuid())
  username         String    @unique
  passwordHash     String    @map("password_hash")
  name             String
  email            String    @default("")
  role             String    @default("user")
  active           Boolean   @default(true)
  setupComplete    Boolean   @default(false) @map("setup_complete")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")
  invoices         Invoice[]
  archivedInvoices Invoice[] @relation("InvoiceArchiver")
  // ...keep existing relations
}

model Invoice {
  id                   String        @id @default(uuid())
  invoiceNumber        String?       @unique @map("invoice_number")
  status               InvoiceStatus @default(DRAFT)
  category             String        @default("SUPPLIES")
  date                 DateTime      @db.Date
  createdBy            String        @map("created_by")
  archivedAt           DateTime?     @map("archived_at")
  archivedBy           String?       @map("archived_by")
  // ...keep existing fields

  creator  User  @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  archiver User? @relation("InvoiceArchiver", fields: [archivedBy], references: [id], onDelete: SetNull)
  staff    Staff? @relation(fields: [staffId], references: [id])
  contact  Contact? @relation(fields: [contactId], references: [id])
  items    InvoiceItem[]

  @@index([type, archivedAt])
  @@index([createdBy, archivedAt])
  @@index([archivedBy, archivedAt])
  @@map("invoices")
}
```

- [ ] **Step 2: Create the migration SQL**

Run: `npx prisma migrate dev --name add_invoice_archive_fields --create-only`

Then edit the generated SQL to preserve existing data:

```sql
ALTER TABLE "invoices" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "archived_by" TEXT;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_archived_by_fkey"
  FOREIGN KEY ("archived_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "invoices_type_archived_at_idx" ON "invoices"("type", "archived_at");
CREATE INDEX "invoices_created_by_archived_at_idx" ON "invoices"("created_by", "archived_at");
CREATE INDEX "invoices_archived_by_archived_at_idx" ON "invoices"("archived_by", "archived_at");
```

- [ ] **Step 3: Regenerate the Prisma client**

Run:

```bash
npx prisma migrate dev
npx prisma generate
```

Expected:

```text
Applying migration `..._add_invoice_archive_fields`
Generated Prisma Client ...
```

- [ ] **Step 4: Extend invoice and quote response DTOs with archive metadata**

In `src/domains/invoice/types.ts` and `src/domains/quote/types.ts`, add archive fields used by detail pages:

```ts
type ArchivedBySummary = {
  id: string;
  name: string;
} | null;

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string | null;
  // ...existing fields
  archivedAt: string | null;
  archivedBy: ArchivedBySummary;
}

export interface QuoteResponse {
  id: string;
  quoteNumber: string | null;
  // ...existing fields
  archivedAt: string | null;
  archivedBy: ArchivedBySummary;
}
```

- [ ] **Step 5: Create a dedicated cross-document archive DTO file**

Create `src/domains/archive/types.ts`:

```ts
export type ArchiveDocumentType = "INVOICE" | "QUOTE";

export interface ArchivedDocumentResponse {
  id: string;
  type: ArchiveDocumentType;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  status: string | null;
  quoteStatus: string | null;
  department: string;
  creatorId: string;
  creatorName: string;
  recipientName: string | null;
  recipientOrg: string | null;
  totalAmount: number;
  createdAt: string;
  archivedAt: string;
  archivedBy: { id: string; name: string } | null;
}

export interface ArchiveFilters {
  type?: ArchiveDocumentType | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ArchiveListResponse {
  documents: ArchivedDocumentResponse[];
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 6: Verify the Prisma/type groundwork compiles**

Run:

```bash
npx tsc --noEmit
```

Expected: the build fails only for still-unimplemented archive service/repository call sites, not for Prisma schema syntax.

- [ ] **Step 7: Commit the schema/type groundwork**

```bash
git add prisma/schema.prisma prisma/migrations src/domains/invoice/types.ts src/domains/quote/types.ts src/domains/archive/types.ts
git commit -m "feat: add invoice archive fields and archive dto types"
```

---

## Task 2: Invoice and Quote Repositories/Services Become Archive-Aware

**Files:**
- Modify: `src/domains/invoice/repository.ts`
- Modify: `src/domains/invoice/service.ts`
- Modify: `src/domains/quote/repository.ts`
- Modify: `src/domains/quote/service.ts`
- Modify: `tests/domains/invoice/service.test.ts`
- Modify: `tests/domains/quote/service.test.ts`

- [ ] **Step 1: Write the failing service tests for archive/restore behavior**

Add targeted tests to `tests/domains/invoice/service.test.ts`:

```ts
it("archives finalized invoices instead of hard deleting them", async () => {
  mockRepo.findById.mockResolvedValue({ ...mockInvoiceRow, status: "FINAL", archivedAt: null } as never);
  mockRepo.archiveById.mockResolvedValue(undefined as never);

  await invoiceService.archive("inv1", "admin-1");

  expect(mockPdfService.deletePdfFiles).not.toHaveBeenCalled();
  expect(mockRepo.archiveById).toHaveBeenCalledWith("inv1", "admin-1");
});

it("restores an archived invoice", async () => {
  mockRepo.restoreById.mockResolvedValue({ ...mockInvoiceRow, archivedAt: null } as never);

  const result = await invoiceService.restore("inv1");

  expect(mockRepo.restoreById).toHaveBeenCalledWith("inv1");
  expect(result.archivedAt).toBeNull();
});
```

Add matching quote tests to `tests/domains/quote/service.test.ts`:

```ts
it("archives accepted quotes instead of rejecting deletion", async () => {
  mockRepo.findById.mockResolvedValue(makeQuote({ quoteStatus: "ACCEPTED", archivedAt: null }) as never);
  mockRepo.archiveById.mockResolvedValue(undefined as never);

  await quoteService.archive("q1", "u1");

  expect(mockPdfService.deletePdfFiles).not.toHaveBeenCalled();
  expect(mockRepo.archiveById).toHaveBeenCalledWith("q1", "u1");
});

it("rejects quote mutation when the quote is archived", async () => {
  mockRepo.findById.mockResolvedValue(makeQuote({ archivedAt: new Date("2026-04-13T12:00:00Z") }) as never);

  await expect(quoteService.update("q1", { notes: "x" })).rejects.toMatchObject({
    code: "FORBIDDEN",
    message: "Archived quotes must be restored before they can be changed",
  });
});
```

- [ ] **Step 2: Run the service tests and verify they fail for the right reason**

Run:

```bash
npx vitest run tests/domains/invoice/service.test.ts tests/domains/quote/service.test.ts
```

Expected: FAIL with missing `archive` / `restore` / `archiveById` / `restoreById` behavior.

- [ ] **Step 3: Make repository queries exclude archived records by default**

In both repositories, add `archivedAt: null` to active-query builders and extend the detail include to load `archiver`:

```ts
const detailInclude = {
  staff: { /* existing select */ },
  contact: { /* existing select */ },
  creator: { select: { id: true, name: true, username: true } },
  archiver: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
} as const;

function buildWhere(filters: InvoiceFilters): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {
    type: "INVOICE",
    archivedAt: null,
  };
  // existing filters...
  return where;
}
```

Do the same in `src/domains/quote/repository.ts`, and ensure `findByShareToken` / `findAcceptedPublicPaymentCandidate` also require `archivedAt: null`.

- [ ] **Step 4: Add repository methods for archived lookups and archive/restore writes**

Add these methods to both invoice and quote repositories:

```ts
export async function findById(id: string, options?: { includeArchived?: boolean }) {
  return prisma.invoice.findFirst({
    where: {
      id,
      ...(options?.includeArchived ? {} : { archivedAt: null }),
    },
    include: detailInclude,
  });
}

export async function archiveById(id: string, userId: string) {
  return prisma.invoice.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      archivedBy: userId,
    },
    include: detailInclude,
  });
}

export async function restoreById(id: string) {
  return prisma.invoice.update({
    where: { id },
    data: {
      archivedAt: null,
      archivedBy: null,
    },
    include: detailInclude,
  });
}
```

- [ ] **Step 5: Update service mappers and add `archive` / `restore` methods**

In both services, map archive metadata, let `getById` opt into archived reads, and add explicit archive flows:

```ts
async getById(id: string, options?: { includeArchived?: boolean }): Promise<InvoiceResponse | null> {
  const invoice = await invoiceRepository.findById(id, options);
  if (!invoice || invoice.type !== "INVOICE") return null;
  return toInvoiceResponse(invoice);
}

function toInvoiceResponse(invoice: NonNullable<InvoiceWithRelations>): InvoiceResponse {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    // ...existing fields
    archivedAt: invoice.archivedAt?.toISOString() ?? null,
    archivedBy: invoice.archiver
      ? { id: invoice.archiver.id, name: invoice.archiver.name }
      : null,
  };
}

async archive(id: string, actorId: string): Promise<void> {
  const invoice = await invoiceRepository.findById(id, { includeArchived: true });
  if (!invoice || invoice.type !== "INVOICE") {
    throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
  }
  await invoiceRepository.archiveById(id, actorId);
  safePublishAll({ type: "invoice-changed" });
}

async restore(id: string): Promise<InvoiceResponse> {
  const invoice = await invoiceRepository.restoreById(id);
  safePublishAll({ type: "invoice-changed" });
  return toInvoiceResponse(invoice as NonNullable<InvoiceWithRelations>);
}
```

For quotes, keep the same shape and remove the hard-delete restriction block:

```ts
async archive(id: string, actorId: string): Promise<void> {
  const quote = await quoteRepository.findById(id, { includeArchived: true });
  if (!quote || quote.type !== "QUOTE") {
    throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
  }
  await quoteRepository.archiveById(id, actorId);
  safePublishAll({ type: "quote-changed" });
}
```

- [ ] **Step 6: Add a shared archived-document guard inside the services**

Use a single helper per service so all active lifecycle mutations reject archived documents:

```ts
function assertInvoiceIsActive(invoice: { archivedAt?: Date | null }) {
  if (invoice.archivedAt) {
    throw Object.assign(new Error("Archived invoices must be restored before they can be changed"), {
      code: "FORBIDDEN",
    });
  }
}

function assertQuoteIsActive(quote: { archivedAt?: Date | null }) {
  if (quote.archivedAt) {
    throw Object.assign(new Error("Archived quotes must be restored before they can be changed"), {
      code: "FORBIDDEN",
    });
  }
}
```

Call these at the top of invoice `update`, `duplicate`, and `finalize`, and quote `update`, `markSent`, `approveManually`, `declineManually`, `convertToInvoice`, `createRevision`, `resolvePaymentDetails`, and public-payment helpers.

- [ ] **Step 7: Re-run the domain tests**

Run:

```bash
npx vitest run tests/domains/invoice/service.test.ts tests/domains/quote/service.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the repository/service archive behavior**

```bash
git add src/domains/invoice/repository.ts src/domains/invoice/service.ts src/domains/quote/repository.ts src/domains/quote/service.ts tests/domains/invoice/service.test.ts tests/domains/quote/service.test.ts
git commit -m "feat: make quote and invoice services archive-aware"
```

---

## Task 3: Archive API + Route-Level Authorization/Public Quote Guards

**Files:**
- Create: `src/domains/archive/repository.ts`
- Create: `src/domains/archive/service.ts`
- Create: `src/app/api/archive/route.ts`
- Create: `src/app/api/archive/[id]/restore/route.ts`
- Modify: `src/app/api/invoices/[id]/route.ts`
- Modify: `src/app/api/invoices/[id]/finalize/route.ts`
- Modify: `src/app/api/invoices/[id]/duplicate/route.ts`
- Modify: `src/app/api/invoices/[id]/pdf/route.ts`
- Modify: `src/app/api/quotes/[id]/route.ts`
- Modify: `src/app/api/quotes/[id]/pdf/route.ts`
- Modify: `src/app/api/quotes/[id]/views/route.ts`
- Modify: `src/app/api/quotes/[id]/follow-ups/route.ts`
- Modify: `src/app/api/quotes/public/[token]/route.ts`
- Modify: `src/app/api/quotes/public/[token]/respond/route.ts`
- Modify: `src/app/api/quotes/public/[token]/payment/route.ts`
- Modify: `src/app/api/quotes/[id]/send/route.ts`
- Modify: `src/app/api/quotes/[id]/approve/route.ts`
- Modify: `src/app/api/quotes/[id]/decline/route.ts`
- Modify: `src/app/api/quotes/[id]/convert/route.ts`
- Modify: `src/app/api/quotes/[id]/revise/route.ts`
- Modify: `src/app/api/quotes/[id]/payment-details/route.ts`
- Create: `tests/app/api/archive-route.test.ts`
- Create: `tests/app/api/invoice-id-route.test.ts`
- Modify: `tests/app/api/quote-transition-route.test.ts`
- Modify: `tests/app/api/public-quote-route.test.ts`
- Modify: `tests/app/api/public-payment-route.test.ts`
- Modify: `tests/app/api/public-respond-route.test.ts`

- [ ] **Step 1: Write failing API tests for archive listing, restore, and delete-as-archive**

Create `tests/app/api/archive-route.test.ts` with coverage like:

```ts
it("lists only the current user's archived documents for non-admins", async () => {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
  vi.mocked(archiveService.list).mockResolvedValue({
    documents: [{ id: "q1", type: "QUOTE", archivedAt: "2026-04-13T12:00:00.000Z" }],
    total: 1,
    page: 1,
    pageSize: 20,
  } as never);

  const response = await GET(new NextRequest("http://localhost/api/archive"));

  expect(response.status).toBe(200);
  expect(archiveService.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, "u1", false);
});

it("restores an archived document", async () => {
  vi.mocked(archiveService.restore).mockResolvedValue({ id: "q1", type: "QUOTE" } as never);

  const response = await POST(
    new NextRequest("http://localhost/api/archive/q1/restore", { method: "POST" }),
    { params: Promise.resolve({ id: "q1" }) },
  );

  expect(response.status).toBe(200);
});
```

Create `tests/app/api/invoice-id-route.test.ts`:

```ts
it("archives an invoice instead of hard-deleting it", async () => {
  vi.mocked(invoiceService.getById).mockResolvedValue({ id: "inv1", creatorId: "u1", type: "INVOICE" } as never);
  vi.mocked(invoiceService.archive).mockResolvedValue(undefined as never);

  const response = await DELETE(
    new NextRequest("http://localhost/api/invoices/inv1", { method: "DELETE" }),
    { params: Promise.resolve({ id: "inv1" }) },
  );

  expect(response.status).toBe(200);
  expect(invoiceService.archive).toHaveBeenCalledWith("inv1", "u1");
});
```

Extend `tests/app/api/quote-transition-route.test.ts` to expect `quoteService.archive("q1", "u1")`, not `quoteService.delete("q1")`.

- [ ] **Step 2: Run the API tests and verify they fail**

Run:

```bash
npx vitest run tests/app/api/archive-route.test.ts tests/app/api/invoice-id-route.test.ts tests/app/api/quote-transition-route.test.ts
```

Expected: FAIL with missing routes / wrong delete service calls.

- [ ] **Step 3: Implement the cross-document archive repository/service**

Create `src/domains/archive/repository.ts` with a scoped archive list query:

```ts
export async function findMany(
  filters: ArchiveFilters,
  userId: string,
  isAdmin: boolean,
) {
  const where: Prisma.InvoiceWhereInput = {
    archivedAt: { not: null },
    ...(isAdmin ? {} : { createdBy: userId }),
    ...(filters.type && filters.type !== "all" ? { type: filters.type } : {}),
    ...(filters.search
      ? {
          OR: [
            { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
            { quoteNumber: { contains: filters.search, mode: "insensitive" } },
            { department: { contains: filters.search, mode: "insensitive" } },
            { recipientName: { contains: filters.search, mode: "insensitive" } },
            { recipientOrg: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return prisma.invoice.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      archiver: { select: { id: true, name: true } },
    },
    orderBy: { archivedAt: "desc" },
  });
}
```

Create `src/domains/archive/service.ts` that maps the list response and dispatches restore by document type:

```ts
async restore(id: string, userId: string, isAdmin: boolean) {
  const record = await invoiceRepository.findById(id, { includeArchived: true });
  if (!record?.archivedAt) throw Object.assign(new Error("Archived document not found"), { code: "NOT_FOUND" });
  if (!isAdmin && record.createdBy !== userId) {
    throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
  }
  return record.type === "QUOTE"
    ? quoteService.restore(id)
    : invoiceService.restore(id);
}
```

- [ ] **Step 4: Update invoice/quote detail routes to support archived reads and archive writes**

In `src/app/api/invoices/[id]/route.ts`:

```ts
const existing = await invoiceService.getById(id, { includeArchived: true });
if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
  return forbiddenResponse();
}

await invoiceService.archive(id, session.user.id);
return NextResponse.json({ success: true });
```

Apply the same pattern in `src/app/api/quotes/[id]/route.ts`, using `quoteService.archive`.

- [ ] **Step 5: Make archived public quotes behave as not found**

In the public quote routes, treat any archived quote like a missing share token:

```ts
const quote = await quoteService.getByShareToken(token);
if (!quote || quote.archivedAt) {
  return NextResponse.json({ error: "Quote not found" }, { status: 404 });
}
```

Use the same guard in:

- `src/app/api/quotes/public/[token]/route.ts`
- `src/app/api/quotes/public/[token]/respond/route.ts`
- `src/app/api/quotes/public/[token]/payment/route.ts`

Also update these internal routes to use `getById(id, { includeArchived: true })` so owner/admin viewers can still read archived detail/PDF/activity data while mutation routes return the archived-document `FORBIDDEN` error instead of a misleading 404:

- `src/app/api/invoices/[id]/pdf/route.ts`
- `src/app/api/quotes/[id]/pdf/route.ts`
- `src/app/api/quotes/[id]/views/route.ts`
- `src/app/api/quotes/[id]/follow-ups/route.ts`
- `src/app/api/invoices/[id]/finalize/route.ts`
- `src/app/api/invoices/[id]/duplicate/route.ts`
- `src/app/api/quotes/[id]/send/route.ts`
- `src/app/api/quotes/[id]/approve/route.ts`
- `src/app/api/quotes/[id]/decline/route.ts`
- `src/app/api/quotes/[id]/convert/route.ts`
- `src/app/api/quotes/[id]/revise/route.ts`
- `src/app/api/quotes/[id]/payment-details/route.ts`

- [ ] **Step 6: Re-run the API tests**

Run:

```bash
npx vitest run tests/app/api/archive-route.test.ts tests/app/api/invoice-id-route.test.ts tests/app/api/quote-transition-route.test.ts tests/app/api/public-quote-route.test.ts tests/app/api/public-payment-route.test.ts tests/app/api/public-respond-route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the archive/API layer**

```bash
git add src/domains/archive src/app/api/invoices/[id]/route.ts src/app/api/quotes/[id]/route.ts src/app/api/quotes/public src/app/api/quotes/[id]/send/route.ts src/app/api/quotes/[id]/approve/route.ts src/app/api/quotes/[id]/decline/route.ts src/app/api/quotes/[id]/convert/route.ts src/app/api/quotes/[id]/revise/route.ts src/app/api/quotes/[id]/payment-details/route.ts tests/app/api/archive-route.test.ts tests/app/api/invoice-id-route.test.ts tests/app/api/quote-transition-route.test.ts tests/app/api/public-quote-route.test.ts tests/app/api/public-payment-route.test.ts tests/app/api/public-respond-route.test.ts
git commit -m "feat: add archive routes and archive-aware document endpoints"
```

---

## Task 4: Archive UI, Detail-View Restore, and Consistent Delete Confirmation

**Files:**
- Create: `src/domains/archive/api-client.ts`
- Create: `src/domains/archive/hooks.ts`
- Create: `src/app/archive/page.tsx`
- Create: `src/components/archive/archive-page-client.tsx`
- Create: `src/components/archive/archive-table.tsx`
- Modify: `src/components/nav.tsx`
- Modify: `src/components/invoices/invoice-detail.tsx`
- Modify: `src/components/invoices/invoice-detail-header.tsx`
- Modify: `src/components/quotes/quote-detail.tsx`
- Modify: `src/__tests__/quote-detail.test.tsx`
- Create: `src/__tests__/invoice-detail.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Extend `src/__tests__/quote-detail.test.tsx`:

```ts
it("shows delete for accepted archived-manageable quotes and offers restore when archived", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/quotes/q1") {
      return {
        ok: true,
        json: async () => makeQuote({
          quoteStatus: "ACCEPTED",
          convertedToInvoice: null,
          archivedAt: "2026-04-13T12:00:00.000Z",
          archivedBy: { id: "u1", name: "Admin" },
        }),
      } satisfies Partial<Response>;
    }
    throw new Error(`Unexpected fetch: ${String(input)}`);
  }));

  render(<QuoteDetailView id="q1" />);

  await screen.findByText("Q-1");
  expect(screen.getByText(/This quote is in the Deleted Archive/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Restore/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Approve Manually/i })).not.toBeInTheDocument();
});
```

Create `src/__tests__/invoice-detail.test.tsx`:

```ts
it("uses the confirmation dialog for finalized invoices", async () => {
  render(<InvoiceDetailView id="inv1" />);

  await screen.findByText("INV-1");
  await user.click(screen.getByRole("button", { name: /^Delete$/ }));

  expect(screen.getByRole("dialog", { name: /Delete Invoice/i })).toBeInTheDocument();
  expect(screen.getByText(/moved to the deleted archive/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component tests and verify they fail**

Run:

```bash
npx vitest run src/__tests__/quote-detail.test.tsx src/__tests__/invoice-detail.test.tsx
```

Expected: FAIL because the archived banner, restore action, and invoice dialog copy do not exist yet.

- [ ] **Step 3: Add archive api-client/hook support**

Create `src/domains/archive/api-client.ts`:

```ts
const BASE = "/api/archive";

export const archiveApi = {
  async list(filters: ArchiveFilters = {}): Promise<ArchiveListResponse> {
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
    return request<ArchiveListResponse>(`${BASE}?${params}`);
  },

  async restore(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${BASE}/${id}/restore`, { method: "POST" });
  },
};
```

Create `src/domains/archive/hooks.ts`:

```ts
export function useArchive(filters: ArchiveFilters = {}) {
  const [data, setData] = useState<ArchiveListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await archiveApi.list(filters));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load archive");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}
```

- [ ] **Step 4: Build the archive page and add navigation**

Create `src/app/archive/page.tsx` and `src/components/archive/archive-page-client.tsx` / `archive-table.tsx`:

```tsx
export default function ArchivePage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deleted Archive</h1>
        <p className="text-sm text-muted-foreground">
          Restore invoices and quotes you previously deleted.
        </p>
      </div>
      <ArchivePageClient />
    </main>
  );
}
```

```tsx
const links: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/quotes", label: "Quotes" },
  { href: "/archive", label: "Deleted Archive", matchPrefix: "/archive" },
  { href: "/textbook-requisitions", label: "Requisitions", matchPrefix: "/textbook-requisitions" },
  { href: "/calendar", label: "Calendar" },
  { href: "/staff", label: "Staff" },
];
```

- [ ] **Step 5: Update invoice and quote detail views for archive semantics**

In `src/components/invoices/invoice-detail.tsx`, remove `window.confirm` and always use the dialog:

```ts
function handleDeleteClick() {
  if (!invoice) return;
  setDeleteDialogOpen(true);
}
```

Show an archive banner and restore button when archived:

```tsx
{invoice.archivedAt && (
  <Card className="border-amber-300 bg-amber-50">
    <CardContent className="py-4 text-sm text-amber-950">
      This invoice is in the Deleted Archive.
      <Button size="sm" onClick={handleRestore}>Restore</Button>
    </CardContent>
  </Card>
)}
```

Apply the same archive banner/restore pattern in `src/components/quotes/quote-detail.tsx`, and hide active workflow buttons when `quote.archivedAt` is set.

- [ ] **Step 6: Re-run the component tests**

Run:

```bash
npx vitest run src/__tests__/quote-detail.test.tsx src/__tests__/invoice-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the archive UI**

```bash
git add src/domains/archive/api-client.ts src/domains/archive/hooks.ts src/app/archive/page.tsx src/components/archive src/components/nav.tsx src/components/invoices/invoice-detail.tsx src/components/invoices/invoice-detail-header.tsx src/components/quotes/quote-detail.tsx src/__tests__/quote-detail.test.tsx src/__tests__/invoice-detail.test.tsx
git commit -m "feat: add deleted archive ui and restore actions"
```

---

## Task 5: Chat Tool Consistency, E2E Coverage, and Full Verification

**Files:**
- Modify: `src/domains/chat/tools.ts`
- Modify: `e2e/quotes.spec.ts`
- Modify: `e2e/invoices.spec.ts`

- [ ] **Step 1: Add the failing end-to-end coverage**

In `e2e/quotes.spec.ts`, add:

```ts
test("accepted quotes can be moved to the deleted archive and restored", async ({ page }) => {
  await createDraftQuote(page, "archive-accepted");
  await markQuoteSent(page);
  await approveQuoteWithCheck(page);

  await page.getByRole("button", { name: /More/i }).click();
  await page.getByRole("menuitem", { name: /^Delete$/ }).click();
  await page.getByRole("button", { name: /^Delete Quote$/ }).click();

  await expect(page).toHaveURL(/\/quotes$/, { timeout: 15_000 });
  await page.goto("/archive");
  await page.getByRole("button", { name: /Restore/i }).click();
  await expect(page.getByText(/restored/i)).toBeVisible();
});
```

In `e2e/invoices.spec.ts`, add:

```ts
function uniqueSuffix(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createDraftInvoice(page: Page, prefix: string) {
  const suffix = uniqueSuffix(prefix);
  await page.goto("/invoices/new");
  await page.getByRole("heading", { name: /New Invoice/i }).waitFor();
  await page.locator("#department").fill(`Archive ${suffix}`);
  await page.getByRole("combobox", { name: "Item description…" }).fill(`Archive item ${suffix}`);
  await page.getByRole("combobox", { name: "Item description…" }).press("Tab");
  await page.getByRole("spinbutton", { name: /Line item 1 unit price/i }).fill("15");
  await page.getByRole("button", { name: /Save Draft/i }).click();
  await expect(page).toHaveURL(/\/invoices\/[a-z0-9-]+/i, { timeout: 15_000 });
}

async function finalizeCurrentInvoice(page: Page) {
  await page.getByRole("link", { name: /Edit/i }).click().catch(() => {});
  const invoiceNumberInput = page.locator("#invoiceNumber");
  if (await invoiceNumberInput.isVisible().catch(() => false)) {
    await invoiceNumberInput.fill(`AG-${Date.now()}`);
    await page.getByRole("button", { name: /Generate PDF/i }).click();
  } else {
    await page.getByRole("button", { name: /Generate PDF|Regenerate PDF/i }).click();
  }
  await expect(page.getByText(/^Final$/i)).toBeVisible({ timeout: 15_000 });
}

test("finalized invoices can be archived and restored", async ({ page }) => {
  await createDraftInvoice(page, "archive-final");
  await finalizeCurrentInvoice(page);

  await page.getByRole("button", { name: /^Delete$/ }).click();
  await page.getByRole("button", { name: /^Delete Invoice$/ }).click();

  await page.goto("/archive");
  await page.getByRole("button", { name: /Restore/i }).click();
  await expect(page.getByText(/Invoice restored/i)).toBeVisible();
});
```

- [ ] **Step 2: Update chat-tool copy and guard logic**

In `src/domains/chat/tools.ts`, change the deletion tools from hard-delete semantics to archive semantics:

```ts
deleteInvoice: tool({
  description:
    "Move an invoice to the Deleted Archive. ALWAYS ask the user to confirm before deleting.",
  // ...
  execute: async ({ id, confirmed }) => {
    if (!confirmed) return { error: "Please confirm you want to move this invoice to the Deleted Archive" };
    const existing = await invoiceService.getById(id, { includeArchived: true });
    if (!existing) return { error: "Invoice not found" };
    if (user.role !== "admin" && existing.creatorId !== user.id) {
      return { error: "You don't have permission to archive this invoice" };
    }
    await invoiceService.archive(id, user.id);
    return { message: "Invoice moved to the Deleted Archive." };
  },
}),
```

Apply the same change to `deleteQuote`.

- [ ] **Step 3: Run the focused E2E suite**

Run:

```bash
npx playwright test e2e/quotes.spec.ts e2e/invoices.spec.ts --project=authenticated --grep "deleted archive|archive and restored|finalized invoices can be archived"
```

Expected: PASS.

- [ ] **Step 4: Run the full validation command**

Run:

```bash
npm run ship-check
```

Expected:

```text
git status ...
lint ...
test ...
build ...
```

All stages should pass.

- [ ] **Step 5: Commit the final integration pass**

```bash
git add src/domains/chat/tools.ts e2e/quotes.spec.ts e2e/invoices.spec.ts
git commit -m "feat: add recoverable deleted archive for quotes and invoices"
```

---

## Self-Review

### Spec Coverage

- Archive authorization: covered in Tasks 2 and 3.
- Owner/admin-only archive visibility: covered in Task 3.
- Restore behavior: covered in Tasks 2, 3, and 4.
- Deleted archive page: covered in Task 4.
- Public quote blocking while archived: covered in Task 3.
- Detail-page archived banner and restore action: covered in Task 4.
- Chat-tool consistency: covered in Task 5.
- End-to-end regression: covered in Task 5.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task names exact files and exact commands.
- Every code-changing step includes concrete code snippets.

### Type Consistency

- Internal persistence names use `archivedAt` / `archivedBy`.
- User-facing product language remains “Deleted Archive.”
- Archive DTOs use `ArchiveListResponse` / `ArchivedDocumentResponse` consistently across API client, service, and UI.
