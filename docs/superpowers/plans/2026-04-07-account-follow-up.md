# Account Number Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recurring follow-up emails for invoices and quotes missing account numbers, with a token-based public form, badge overlays, dashboard widget, and weekly cron job.

**Architecture:** Rename `QuoteFollowUp` → `FollowUp` with new series-tracking fields. New `follow-up` domain module with repository, service, api-client, hooks. Claim-then-promote pattern for email sends. Public token-based form for account number submission. Weekly cron job with escalating tone.

**Tech Stack:** Prisma 7 (migration + model), Next.js 14 App Router (API routes + pages), Vitest (tests), Power Automate webhook (email), Supabase Realtime (events), node-cron (scheduler).

**Spec:** `docs/superpowers/specs/2026-04-07-account-follow-up-design.md`

---

## Task 1: Prisma Migration — Rename QuoteFollowUp to FollowUp + Add Fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDD_rename_follow_up_add_series/migration.sql`

- [ ] **Step 1: Update the Prisma schema**

In `prisma/schema.prisma`, rename the `QuoteFollowUp` model to `FollowUp` and add new fields:

```prisma
model FollowUp {
  id             String   @id @default(uuid())
  invoiceId      String   @map("invoice_id")
  type           String
  recipientEmail String   @map("recipient_email")
  subject        String
  sentAt         DateTime @default(now()) @map("sent_at")
  metadata       Json?
  seriesId       String?  @map("series_id")
  shareToken     String?  @unique @map("share_token")
  seriesStatus   String?  @map("series_status")
  maxAttempts    Int?     @map("max_attempts")

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId, sentAt])
  @@index([seriesId])
  @@index([seriesStatus, type])
  @@map("follow_ups")
}
```

Also update the Invoice model's relation field from `followUps QuoteFollowUp[]` to `followUps FollowUp[]`.

- [ ] **Step 2: Create the migration SQL**

Run: `npx prisma migrate dev --name rename_follow_up_add_series --create-only`

Then edit the generated migration SQL to use `ALTER TABLE RENAME` instead of drop-and-recreate:

```sql
-- Rename table
ALTER TABLE "quote_follow_ups" RENAME TO "follow_ups";

-- Add new columns
ALTER TABLE "follow_ups" ADD COLUMN "series_id" TEXT;
ALTER TABLE "follow_ups" ADD COLUMN "share_token" TEXT;
ALTER TABLE "follow_ups" ADD COLUMN "series_status" TEXT;
ALTER TABLE "follow_ups" ADD COLUMN "max_attempts" INTEGER;

-- Add indexes
CREATE UNIQUE INDEX "follow_ups_share_token_key" ON "follow_ups"("share_token");
CREATE INDEX "follow_ups_series_id_idx" ON "follow_ups"("series_id");
CREATE INDEX "follow_ups_series_status_type_idx" ON "follow_ups"("series_status", "type");

-- Rename existing indexes to match new table name
ALTER INDEX "quote_follow_ups_pkey" RENAME TO "follow_ups_pkey";
ALTER INDEX "quote_follow_ups_invoice_id_sent_at_idx" RENAME TO "follow_ups_invoice_id_sent_at_idx";
```

- [ ] **Step 3: Apply the migration and regenerate**

Run: `npx prisma migrate dev`

Then: `npx prisma generate`

Expected: Migration applied, client regenerated with `FollowUp` model.

- [ ] **Step 4: Update existing code references from QuoteFollowUp to FollowUp**

**All** `quoteFollowUp` references in the codebase must be renamed. Use project-wide find-and-replace: `tx.quoteFollowUp` → `tx.followUp`, `prisma.quoteFollowUp` → `prisma.followUp`. The complete list:

**`src/domains/quote/follow-ups.ts`** (8 occurrences):
- Line 93: `tx.quoteFollowUp.findFirst` → `tx.followUp.findFirst`
- Line 105: `tx.quoteFollowUp.deleteMany` → `tx.followUp.deleteMany`
- Line 113: `tx.quoteFollowUp.findFirst` → `tx.followUp.findFirst`
- Line 123: `tx.quoteFollowUp.count` → `tx.followUp.count`
- Line 128: `tx.quoteFollowUp.create` → `tx.followUp.create`
- Line 200: `prisma.quoteFollowUp.delete` → `prisma.followUp.delete`
- Line 231: `prisma.quoteFollowUp.delete` → `prisma.followUp.delete`
- Line 237: `prisma.quoteFollowUp.delete` → `prisma.followUp.delete`
- Line 241: `prisma.quoteFollowUp.update` → `prisma.followUp.update`

**`src/domains/quote/service.ts`** (2 occurrences):
- Line 412: `tx.quoteFollowUp.create` → `tx.followUp.create`
- Line 1559: `tx.quoteFollowUp.create` → `tx.followUp.create`

**`src/domains/quote/repository.ts`** (2 occurrences):
- Line 458: `prisma.quoteFollowUp.create` → `prisma.followUp.create`
- Line 475: `prisma.quoteFollowUp.findMany` → `prisma.followUp.findMany`

Also update the `findFollowUpsByInvoiceId` function in `src/domains/quote/repository.ts`:

```typescript
export async function findFollowUpsByInvoiceId(invoiceId: string) {
  return prisma.followUp.findMany({
    where: {
      invoiceId,
      type: { not: PAYMENT_REMINDER_CLAIM },
    },
    orderBy: { sentAt: "desc" },
  });
}
```

After renaming, run `grep -r "quoteFollowUp" src/ --include="*.ts" --include="*.tsx" | grep -v generated/` to verify no references remain outside the generated Prisma client.

- [ ] **Step 5: Verify existing tests still pass**

Run: `npx vitest run --dir tests/domains/quote`

Expected: All existing quote tests pass with the renamed model.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/domains/quote/follow-ups.ts src/domains/quote/repository.ts src/domains/quote/service.ts
git commit -m "refactor: rename QuoteFollowUp to FollowUp, add series tracking fields"
```

---

## Task 2: Follow-Up Domain — Types

**Files:**
- Create: `src/domains/follow-up/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/domains/follow-up/types.ts

export const ACCOUNT_FOLLOWUP = "ACCOUNT_FOLLOWUP" as const;
export const ACCOUNT_FOLLOWUP_CLAIM = "ACCOUNT_FOLLOWUP_CLAIM" as const;
export const ACCOUNT_FOLLOWUP_TYPES = [ACCOUNT_FOLLOWUP, ACCOUNT_FOLLOWUP_CLAIM] as const;

export type FollowUpSeriesStatus = "ACTIVE" | "COMPLETED" | "EXHAUSTED";

export type FollowUpBadgeState = {
  seriesStatus: FollowUpSeriesStatus;
  currentAttempt: number;
  maxAttempts: number;
};

export type FollowUpSeriesResponse = {
  seriesId: string;
  invoiceId: string;
  seriesStatus: FollowUpSeriesStatus;
  shareToken: string | null;
  maxAttempts: number;
  currentAttempt: number;
  recipientEmail: string;
  createdAt: string;
  lastSentAt: string;
};

export type InitiateFollowUpRequest = {
  invoiceIds: string[];
};

export type InitiateFollowUpResult = {
  invoiceId: string;
  status: "success" | "error";
  seriesId?: string;
  error?: string;
};

export type InitiateFollowUpResponse = {
  results: InitiateFollowUpResult[];
  summary: { succeeded: number; failed: number };
};

export type PublicFollowUpSummary = {
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: "INVOICE" | "QUOTE";
  description: string;
  totalAmount: number;
  creatorName: string;
  currentAttempt: number;
  maxAttempts: number;
  seriesStatus: FollowUpSeriesStatus;
};

export type SubmitAccountNumberRequest = {
  accountNumber: string;
};

export const ESCALATING_SUBJECTS: Record<number, (num: string) => string> = {
  1: (num) => `Account number needed — ${num}`,
  2: (num) => `Reminder: Account number still needed — ${num}`,
  3: (num) => `Action required: Account number for ${num}`,
  4: (num) => `Urgent: Account number overdue — ${num}`,
  5: (num) => `Final notice: Account number required — ${num}`,
};

export const ESCALATING_TONES: Record<number, string> = {
  1: "friendly",
  2: "gentle",
  3: "firm",
  4: "urgent",
  5: "final",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/follow-up/types.ts
git commit -m "feat: add follow-up domain types for account number series"
```

---

## Task 3: Follow-Up Domain — Repository

**Files:**
- Create: `src/domains/follow-up/repository.ts`
- Create: `tests/domains/follow-up/repository.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domains/follow-up/repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    followUp: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
      followUp: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      invoice: { findUnique: vi.fn(), update: vi.fn() },
      $queryRaw: vi.fn(),
    })),
  },
}));

import { followUpRepository } from "@/domains/follow-up/repository";

describe("followUpRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("findActiveSeriesByInvoiceId", () => {
    it("should query for ACTIVE series by invoiceId", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.followUp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await followUpRepository.findActiveSeriesByInvoiceId("inv-1");
      expect(prisma.followUp.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceId: "inv-1",
            seriesStatus: "ACTIVE",
            type: expect.objectContaining({ in: expect.any(Array) }),
          }),
        })
      );
      expect(result).toBeNull();
    });
  });

  describe("getLatestFollowUpForInvoice", () => {
    it("should return the latest follow-up row for badge computation", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockRow = {
        id: "fu-1",
        seriesStatus: "ACTIVE",
        maxAttempts: 5,
        metadata: { attempt: 2 },
      };
      (prisma.followUp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

      const result = await followUpRepository.getLatestFollowUpForInvoice("inv-1");
      expect(result).toEqual(mockRow);
    });
  });

  describe("countAttempts", () => {
    it("should count only ACCOUNT_FOLLOWUP rows in the series", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.followUp.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const result = await followUpRepository.countAttempts("series-1");
      expect(result).toBe(3);
      expect(prisma.followUp.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { seriesId: "series-1", type: "ACCOUNT_FOLLOWUP" },
        })
      );
    });
  });

  describe("markSeriesStatus", () => {
    it("should update all rows in the series", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.followUp.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

      await followUpRepository.markSeriesStatus("series-1", "COMPLETED");
      expect(prisma.followUp.updateMany).toHaveBeenCalledWith({
        where: { seriesId: "series-1" },
        data: { seriesStatus: "COMPLETED" },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domains/follow-up/repository.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the repository**

```typescript
// src/domains/follow-up/repository.ts
import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_FOLLOWUP,
  ACCOUNT_FOLLOWUP_CLAIM,
  ACCOUNT_FOLLOWUP_TYPES,
  type FollowUpSeriesStatus,
} from "./types";

export const followUpRepository = {
  async findActiveSeriesByInvoiceId(invoiceId: string) {
    return prisma.followUp.findFirst({
      where: {
        invoiceId,
        seriesStatus: "ACTIVE",
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
      },
      orderBy: { sentAt: "desc" },
    });
  },

  async getLatestFollowUpForInvoice(invoiceId: string) {
    return prisma.followUp.findFirst({
      where: {
        invoiceId,
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
      },
      orderBy: { sentAt: "desc" },
    });
  },

  async getFollowUpBadgesForInvoices(invoiceIds: string[]) {
    if (invoiceIds.length === 0) return [];
    return prisma.followUp.findMany({
      where: {
        invoiceId: { in: invoiceIds },
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
        seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
      },
      orderBy: { sentAt: "desc" },
      distinct: ["invoiceId"],
    });
  },

  async findByShareToken(token: string) {
    return prisma.followUp.findFirst({
      where: { shareToken: token },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            quoteNumber: true,
            type: true,
            description: true,
            totalAmount: true,
            accountNumber: true,
            createdBy: true,
            creator: { select: { name: true } },
          },
        },
      },
    });
  },

  async countAttempts(seriesId: string) {
    return prisma.followUp.count({
      where: { seriesId, type: ACCOUNT_FOLLOWUP },
    });
  },

  async markSeriesStatus(seriesId: string, status: FollowUpSeriesStatus) {
    return prisma.followUp.updateMany({
      where: { seriesId },
      data: { seriesStatus: status },
    });
  },

  async createClaimRow(data: {
    invoiceId: string;
    seriesId: string;
    shareToken: string;
    recipientEmail: string;
    subject: string;
    maxAttempts: number;
    attempt: number;
  }) {
    return prisma.followUp.create({
      data: {
        invoiceId: data.invoiceId,
        type: ACCOUNT_FOLLOWUP_CLAIM,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        seriesId: data.seriesId,
        shareToken: data.attempt === 1 ? data.shareToken : undefined,
        seriesStatus: "ACTIVE",
        maxAttempts: data.maxAttempts,
        metadata: { attempt: data.attempt },
      },
    });
  },

  async promoteClaimRow(followUpId: string) {
    return prisma.followUp.update({
      where: { id: followUpId },
      data: { type: ACCOUNT_FOLLOWUP, sentAt: new Date() },
    });
  },

  async deleteClaimRow(followUpId: string) {
    return prisma.followUp.delete({ where: { id: followUpId } }).catch(() => {});
  },

  async deleteStaleClaimsForSeries(seriesId: string, staleThreshold: Date) {
    return prisma.followUp.deleteMany({
      where: {
        seriesId,
        type: ACCOUNT_FOLLOWUP_CLAIM,
        sentAt: { lt: staleThreshold },
      },
    });
  },

  async findFreshClaimForSeries(seriesId: string, freshThreshold: Date) {
    return prisma.followUp.findFirst({
      where: {
        seriesId,
        type: ACCOUNT_FOLLOWUP_CLAIM,
        sentAt: { gte: freshThreshold },
      },
    });
  },

  async findAllActiveSeries() {
    return prisma.followUp.findMany({
      where: {
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
        seriesStatus: "ACTIVE",
      },
      orderBy: { sentAt: "desc" },
      distinct: ["seriesId"],
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            quoteNumber: true,
            type: true,
            accountNumber: true,
            staffId: true,
            createdBy: true,
            staff: { select: { email: true, name: true } },
            creator: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  async getPendingAccountsCount() {
    const rows = await prisma.followUp.findMany({
      where: {
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
        seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
      },
      distinct: ["seriesId"],
      select: { seriesId: true },
    });
    return rows.length;
  },

  async getPendingAccountsSummary() {
    return prisma.followUp.findMany({
      where: {
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
        seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
      },
      orderBy: { sentAt: "desc" },
      distinct: ["seriesId"],
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            quoteNumber: true,
            type: true,
            createdBy: true,
            creator: { select: { id: true, name: true } },
            staff: { select: { name: true } },
          },
        },
      },
    });
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domains/follow-up/repository.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domains/follow-up/repository.ts tests/domains/follow-up/repository.test.ts
git commit -m "feat: add follow-up repository with series queries"
```

---

## Task 4: Follow-Up Domain — Email Templates

**Files:**
- Create: `src/domains/follow-up/email-templates.ts`
- Create: `tests/domains/follow-up/email-templates.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domains/follow-up/email-templates.test.ts
import { describe, it, expect } from "vitest";
import { buildAccountFollowUpEmail } from "@/domains/follow-up/email-templates";

describe("buildAccountFollowUpEmail", () => {
  const baseParams = {
    recipientName: "Jane Smith",
    invoiceNumber: "INV-0042",
    type: "INVOICE" as const,
    description: "Office Supplies",
    totalAmount: 250.00,
    creatorName: "John Doe",
    formUrl: "https://laportal.montalvo.io/account-request/abc-123",
    attempt: 1,
    maxAttempts: 5,
  };

  it("should return friendly tone for attempt 1", () => {
    const { subject, html } = buildAccountFollowUpEmail(baseParams);
    expect(subject).toBe("Account number needed — INV-0042");
    expect(html).toContain("Jane Smith");
    expect(html).toContain("INV-0042");
    expect(html).toContain("$250.00");
    expect(html).toContain("account-request/abc-123");
    expect(html).toContain("1 of 5");
  });

  it("should return urgent tone for attempt 4", () => {
    const { subject, html } = buildAccountFollowUpEmail({ ...baseParams, attempt: 4 });
    expect(subject).toBe("Urgent: Account number overdue — INV-0042");
    expect(html).toContain("4 of 5");
  });

  it("should return final notice for attempt 5", () => {
    const { subject, html } = buildAccountFollowUpEmail({ ...baseParams, attempt: 5 });
    expect(subject).toBe("Final notice: Account number required — INV-0042");
    expect(html).toContain("5 of 5");
    expect(html).toContain("final");
  });

  it("should escape HTML in user-provided values", () => {
    const { html } = buildAccountFollowUpEmail({
      ...baseParams,
      recipientName: '<script>alert("xss")</script>',
      description: "O'Malley & Sons",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("O&#39;Malley &amp; Sons");
  });

  it("should use quote number when type is QUOTE", () => {
    const { subject } = buildAccountFollowUpEmail({
      ...baseParams,
      invoiceNumber: null,
      quoteNumber: "QTE-0018",
      type: "QUOTE",
      attempt: 2,
    });
    expect(subject).toBe("Reminder: Account number still needed — QTE-0018");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domains/follow-up/email-templates.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the email templates**

```typescript
// src/domains/follow-up/email-templates.ts
import { escapeHtml } from "@/lib/html";
import { ESCALATING_SUBJECTS, ESCALATING_TONES } from "./types";

type EmailParams = {
  recipientName: string;
  invoiceNumber: string | null;
  quoteNumber?: string | null;
  type: "INVOICE" | "QUOTE";
  description: string;
  totalAmount: number;
  creatorName: string;
  formUrl: string;
  attempt: number;
  maxAttempts: number;
};

const TONE_MESSAGES: Record<string, string> = {
  friendly:
    "We need your account number to process this charge. Please provide it at your earliest convenience.",
  gentle:
    "This is a friendly reminder that we still need your account number to proceed with processing.",
  firm:
    "We have not yet received the account number required to process this charge. Please provide it as soon as possible.",
  urgent:
    "This charge cannot be processed without your account number. Immediate action is required.",
  final:
    "This is our final request for the account number needed to process this charge. If we do not receive it, the charge will remain unprocessed.",
};

export function buildAccountFollowUpEmail(params: EmailParams): {
  subject: string;
  html: string;
} {
  const docNumber =
    params.type === "QUOTE"
      ? (params.quoteNumber ?? "your quote")
      : (params.invoiceNumber ?? "your invoice");

  const subjectFn = ESCALATING_SUBJECTS[params.attempt] ?? ESCALATING_SUBJECTS[5];
  const subject = subjectFn(docNumber);

  const tone = ESCALATING_TONES[params.attempt] ?? "final";
  const toneMessage = TONE_MESSAGES[tone] ?? TONE_MESSAGES.friendly;

  const amount = `$${params.totalAmount.toFixed(2)}`;

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Account Number Needed</h2>
  <p>Hello ${escapeHtml(params.recipientName)},</p>
  <p>${escapeHtml(toneMessage)}</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px 0; color: #666;">${params.type === "QUOTE" ? "Quote" : "Invoice"}</td>
      <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(docNumber)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Description</td>
      <td style="padding: 8px 0;">${escapeHtml(params.description)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Amount</td>
      <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(amount)}</td>
    </tr>
  </table>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(params.formUrl)}" style="background-color: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Provide Account Number</a>
  </p>
  <p style="color: #666; font-size: 14px;">Or copy this link: ${escapeHtml(params.formUrl)}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">This is reminder ${params.attempt} of ${params.maxAttempts}. If you have questions, contact ${escapeHtml(params.creatorName)}.</p>
  <p style="color: #999; font-size: 12px;">Los Angeles Pierce College Bookstore</p>
</div>`;

  return { subject, html };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domains/follow-up/email-templates.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domains/follow-up/email-templates.ts tests/domains/follow-up/email-templates.test.ts
git commit -m "feat: add escalating email templates for account follow-ups"
```

---

## Task 5: Follow-Up Domain — Service (Initiation)

**Files:**
- Create: `src/domains/follow-up/service.ts`
- Create: `tests/domains/follow-up/service.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domains/follow-up/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    followUp: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/sse", () => ({
  safePublishAll: vi.fn(),
}));

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    createAndPublish: vi.fn(),
  },
}));

vi.mock("@/domains/follow-up/repository", () => ({
  followUpRepository: {
    findActiveSeriesByInvoiceId: vi.fn(),
    createClaimRow: vi.fn(),
    promoteClaimRow: vi.fn(),
    deleteClaimRow: vi.fn(),
    markSeriesStatus: vi.fn(),
    countAttempts: vi.fn(),
    deleteStaleClaimsForSeries: vi.fn(),
    findFreshClaimForSeries: vi.fn(),
  },
}));

import { followUpService } from "@/domains/follow-up/service";
import { followUpRepository } from "@/domains/follow-up/repository";
import { sendEmail } from "@/lib/email";

describe("followUpService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("initiateSingle", () => {
    const mockInvoice = {
      id: "inv-1",
      invoiceNumber: "INV-0042",
      quoteNumber: null,
      type: "INVOICE",
      accountNumber: "",
      description: "Office Supplies",
      totalAmount: { toNumber: () => 250 },
      staffId: "staff-1",
      createdBy: "user-1",
      staff: { email: "jane@piercecollege.edu", name: "Jane Smith" },
      creator: { id: "user-1", name: "John Doe" },
    };

    it("should reject if invoice already has an account number", async () => {
      const result = await followUpService.initiateSingle(
        { ...mockInvoice, accountNumber: "12345" },
        "user-1",
        false,
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("already has an account number");
    });

    it("should reject if no staff member is linked", async () => {
      const result = await followUpService.initiateSingle(
        { ...mockInvoice, staffId: null, staff: null },
        "user-1",
        false,
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("No recipient");
    });

    it("should reject if an active series already exists", async () => {
      (followUpRepository.findActiveSeriesByInvoiceId as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing",
      });
      const result = await followUpService.initiateSingle(mockInvoice, "user-1", false);
      expect(result.status).toBe("error");
      expect(result.error).toContain("already has an active");
    });

    it("should delete claim and return error if email fails", async () => {
      (followUpRepository.findActiveSeriesByInvoiceId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (followUpRepository.createClaimRow as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "claim-1",
        seriesId: "series-1",
        shareToken: "token-1",
      });
      (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await followUpService.initiateSingle(mockInvoice, "user-1", false);
      expect(result.status).toBe("error");
      expect(result.error).toContain("Email send failed");
      expect(followUpRepository.deleteClaimRow).toHaveBeenCalledWith("claim-1");
    });

    it("should promote claim and notify on successful send", async () => {
      (followUpRepository.findActiveSeriesByInvoiceId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (followUpRepository.createClaimRow as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "claim-1",
        seriesId: "series-1",
        shareToken: "token-1",
      });
      (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await followUpService.initiateSingle(mockInvoice, "user-1", false);
      expect(result.status).toBe("success");
      expect(result.seriesId).toBe("series-1");
      expect(followUpRepository.promoteClaimRow).toHaveBeenCalledWith("claim-1");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domains/follow-up/service.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the service**

```typescript
// src/domains/follow-up/service.ts
import { randomUUID } from "crypto";
import { sendEmail } from "@/lib/email";
import { safePublishAll } from "@/lib/sse";
import { followUpRepository } from "./repository";
import { buildAccountFollowUpEmail } from "./email-templates";
import type {
  InitiateFollowUpResult,
  InitiateFollowUpResponse,
  PublicFollowUpSummary,
  FollowUpSeriesStatus,
} from "./types";

const DEFAULT_MAX_ATTEMPTS = 5;
const CLAIM_TTL_MINUTES = 30;

function getAppUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://laportal.montalvo.io";
}

function hashInvoiceIdToLockKey(invoiceId: string): number {
  let hash = 0;
  for (let i = 0; i < invoiceId.length; i++) {
    hash = ((hash << 5) - hash + invoiceId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

type InvoiceForInitiation = {
  id: string;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: string;
  accountNumber: string;
  description: string;
  totalAmount: { toNumber?: () => number } | number;
  staffId: string | null;
  createdBy: string;
  staff: { email: string; name: string } | null;
  creator: { id: string; name: string } | null;
};

export const followUpService = {
  async initiateSingle(
    invoice: InvoiceForInitiation,
    userId: string,
    isAdmin: boolean,
  ): Promise<InitiateFollowUpResult> {
    // Pre-flight checks (no lock needed)
    if (invoice.accountNumber && invoice.accountNumber.trim() !== "") {
      return { invoiceId: invoice.id, status: "error", error: "This item already has an account number" };
    }

    if (!invoice.staffId || !invoice.staff?.email) {
      return { invoiceId: invoice.id, status: "error", error: "No recipient — assign a staff member first" };
    }

    if (!isAdmin && invoice.createdBy !== userId) {
      return { invoiceId: invoice.id, status: "error", error: "Not authorized" };
    }

    // Acquire per-invoice advisory lock, re-check within lock, handle stale claims
    const { prisma } = await import("@/lib/prisma");
    const lockKey = hashInvoiceIdToLockKey(invoice.id);

    const claimResult = await prisma.$transaction(async (tx) => {
      // Acquire advisory lock to prevent concurrent initiations for same invoice
      const lockResult = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${lockKey}) AS acquired
      `;
      if (lockResult[0]?.acquired !== true) {
        return { locked: true as const };
      }

      // Re-check within lock (TOCTOU prevention)
      const freshInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        select: { accountNumber: true },
      });
      if (freshInvoice?.accountNumber && freshInvoice.accountNumber.trim() !== "") {
        return { alreadyHasAccount: true as const };
      }

      // Check for existing active series
      const existing = await tx.followUp.findFirst({
        where: {
          invoiceId: invoice.id,
          seriesStatus: "ACTIVE",
          type: { in: ["ACCOUNT_FOLLOWUP", "ACCOUNT_FOLLOWUP_CLAIM"] },
        },
      });

      // Handle stale claims
      if (existing && existing.type === "ACCOUNT_FOLLOWUP_CLAIM") {
        const staleThreshold = new Date(Date.now() - CLAIM_TTL_MINUTES * 60 * 1000);
        if (existing.sentAt < staleThreshold) {
          // Stale claim — delete and proceed
          await tx.followUp.delete({ where: { id: existing.id } });
        } else {
          // Fresh claim — in-flight, skip
          return { inFlight: true as const };
        }
      } else if (existing) {
        return { alreadyActive: true as const };
      }

      // Create claim row (durable token before email send)
      const seriesId = randomUUID();
      const shareToken = randomUUID();
      const formUrl = `${getAppUrl()}/account-request/${shareToken}`;
      const totalAmount =
        typeof invoice.totalAmount === "number"
          ? invoice.totalAmount
          : (invoice.totalAmount.toNumber?.() ?? Number(invoice.totalAmount));

      const docNumber =
        invoice.type === "QUOTE"
          ? (invoice.quoteNumber ?? "your quote")
          : (invoice.invoiceNumber ?? "your invoice");

      const { subject, html } = buildAccountFollowUpEmail({
        recipientName: invoice.staff!.name,
        invoiceNumber: invoice.invoiceNumber,
        quoteNumber: invoice.quoteNumber ?? undefined,
        type: invoice.type as "INVOICE" | "QUOTE",
        description: invoice.description,
        totalAmount,
        creatorName: invoice.creator?.name ?? "the bookstore",
        formUrl,
        attempt: 1,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      });

      const claim = await tx.followUp.create({
        data: {
          invoiceId: invoice.id,
          type: "ACCOUNT_FOLLOWUP_CLAIM",
          recipientEmail: invoice.staff!.email,
          subject,
          seriesId,
          shareToken,
          seriesStatus: "ACTIVE",
          maxAttempts: DEFAULT_MAX_ATTEMPTS,
          metadata: { attempt: 1 },
        },
      });

      return { claim, seriesId, subject, html, docNumber };
    });

    // Handle lock/check failures
    if ("locked" in claimResult) {
      return { invoiceId: invoice.id, status: "error", error: "Another request is in progress — please retry" };
    }
    if ("alreadyHasAccount" in claimResult) {
      return { invoiceId: invoice.id, status: "error", error: "This item already has an account number" };
    }
    if ("inFlight" in claimResult) {
      return { invoiceId: invoice.id, status: "error", error: "A request is already being sent" };
    }
    if ("alreadyActive" in claimResult) {
      return { invoiceId: invoice.id, status: "error", error: "This item already has an active follow-up series" };
    }

    // Send email outside the transaction
    const { claim, seriesId, subject, html, docNumber } = claimResult;
    const sent = await sendEmail(invoice.staff!.email, subject, html);
    if (!sent) {
      await prisma.followUp.delete({ where: { id: claim.id } }).catch(() => {});
      return { invoiceId: invoice.id, status: "error", error: "Email send failed — please retry" };
    }

    // Promote claim
    await prisma.followUp.update({
      where: { id: claim.id },
      data: { type: "ACCOUNT_FOLLOWUP", sentAt: new Date() },
    });

    try {
      const { notificationService } = await import("@/domains/notification/service");
      const notificationData: import("@/domains/notification/types").CreateNotificationInput = {
        userId: invoice.createdBy,
        type: "ACCOUNT_FOLLOWUP_SENT" as import("@/domains/notification/types").NotificationType,
        title: `Follow Up 1/${DEFAULT_MAX_ATTEMPTS} Sent`,
        message: `Follow-up 1 sent for ${docNumber} to ${invoice.staff!.name}`,
      };
      // Route notification to correct detail page based on document type
      if (invoice.type === "QUOTE") {
        notificationData.quoteId = invoice.id;
      } else {
        notificationData.invoiceId = invoice.id;
      }
      await notificationService.createAndPublish(notificationData);
    } catch {
      // Non-critical
    }

    safePublishAll({ type: invoice.type === "QUOTE" ? "quote-changed" : "invoice-changed" });

    return { invoiceId: invoice.id, status: "success", seriesId };
  },

  async initiateMultiple(
    invoiceIds: string[],
    userId: string,
    isAdmin: boolean,
  ): Promise<InitiateFollowUpResponse> {
    const { prisma } = await import("@/lib/prisma");
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      include: {
        staff: { select: { email: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    const foundIds = new Set(invoices.map((inv) => inv.id));
    const results: InitiateFollowUpResult[] = [];

    // Return explicit errors for IDs not found in the database
    for (const id of invoiceIds) {
      if (!foundIds.has(id)) {
        results.push({ invoiceId: id, status: "error", error: "Invoice/quote not found" });
      }
    }

    // Process found invoices sequentially
    for (const invoice of invoices) {
      const result = await this.initiateSingle(
        invoice as unknown as InvoiceForInitiation,
        userId,
        isAdmin,
      );
      results.push(result);
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;

    return { results, summary: { succeeded, failed } };
  },

  async getPublicSummary(token: string): Promise<PublicFollowUpSummary | null> {
    const row = await followUpRepository.findByShareToken(token);
    if (!row || !row.invoice) return null;

    const inv = row.invoice;
    const attempt = (row.metadata as Record<string, unknown>)?.attempt as number ?? 1;

    return {
      invoiceNumber: inv.invoiceNumber,
      quoteNumber: inv.quoteNumber,
      type: inv.type as "INVOICE" | "QUOTE",
      description: inv.description ?? "",
      totalAmount: Number(inv.totalAmount),
      creatorName: inv.creator?.name ?? "the bookstore",
      currentAttempt: attempt,
      maxAttempts: row.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      seriesStatus: (row.seriesStatus as FollowUpSeriesStatus) ?? "ACTIVE",
    };
  },

  async submitAccountNumber(
    token: string,
    accountNumber: string,
  ): Promise<{ success: boolean; alreadyResolved?: boolean; error?: string }> {
    const row = await followUpRepository.findByShareToken(token);
    if (!row || !row.invoice) {
      return { success: false, error: "Invalid or expired link" };
    }

    if (
      row.seriesStatus === "COMPLETED" ||
      row.seriesStatus === "EXHAUSTED" ||
      (row.invoice.accountNumber && row.invoice.accountNumber.trim() !== "")
    ) {
      return { success: true, alreadyResolved: true };
    }

    const trimmed = accountNumber.trim();
    if (!trimmed || trimmed.length > 100) {
      return { success: false, error: "Please provide a valid account number" };
    }

    const { prisma } = await import("@/lib/prisma");
    await prisma.invoice.update({
      where: { id: row.invoice.id },
      data: { accountNumber: trimmed },
    });

    await followUpRepository.markSeriesStatus(row.seriesId!, "COMPLETED");

    try {
      const { notificationService } = await import("@/domains/notification/service");
      const notifRef = row.invoice.type === "QUOTE"
        ? { quoteId: row.invoice.id }
        : { invoiceId: row.invoice.id };
      await notificationService.createAndPublish({
        userId: row.invoice.createdBy,
        type: "ACCOUNT_NUMBER_RECEIVED" as import("@/domains/notification/types").NotificationType,
        title: "Account Number Received",
        message: `Account number received for ${row.invoice.invoiceNumber ?? row.invoice.quoteNumber ?? "item"}`,
        ...notifRef,
      });
    } catch {
      // Non-critical
    }

    const eventType = row.invoice.type === "QUOTE" ? "quote-changed" : "invoice-changed";
    safePublishAll({ type: eventType });

    return { success: true };
  },

  async getBadgeState(invoiceId: string) {
    const latest = await followUpRepository.getLatestFollowUpForInvoice(invoiceId);
    if (!latest || !latest.seriesStatus || latest.seriesStatus === "COMPLETED") return null;

    const attempt = (latest.metadata as Record<string, unknown>)?.attempt as number ?? 1;
    return {
      seriesStatus: latest.seriesStatus as FollowUpSeriesStatus,
      currentAttempt: attempt,
      maxAttempts: latest.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    };
  },

  async getBadgeStatesForInvoices(invoiceIds: string[]) {
    const rows = await followUpRepository.getFollowUpBadgesForInvoices(invoiceIds);
    const badges: Record<string, { seriesStatus: FollowUpSeriesStatus; currentAttempt: number; maxAttempts: number }> = {};
    for (const row of rows) {
      const attempt = (row.metadata as Record<string, unknown>)?.attempt as number ?? 1;
      badges[row.invoiceId] = {
        seriesStatus: row.seriesStatus as FollowUpSeriesStatus,
        currentAttempt: attempt,
        maxAttempts: row.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      };
    }
    return badges;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domains/follow-up/service.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domains/follow-up/service.ts tests/domains/follow-up/service.test.ts
git commit -m "feat: add follow-up service with initiation and public form logic"
```

---

## Task 6: Update Notification Types + Fix Invoice Routing

**Files:**
- Modify: `src/domains/notification/types.ts`
- Modify: `src/domains/notification/repository.ts`
- Modify: `src/components/notifications/notification-bell.tsx`
- Create: `prisma/migrations/YYYYMMDD_add_notification_invoice_id/migration.sql`

The existing notification model only has `quoteId`, and the bell UI always routes to `/quotes/{quoteId}`. Account follow-up notifications need to link to invoices too. This task adds `invoiceId` to notifications and fixes routing.

- [ ] **Step 1: Add `invoiceId` to the Notification model in `prisma/schema.prisma`**

```prisma
model Notification {
  // ... existing fields ...
  quoteId   String?  @map("quote_id")
  invoiceId String?  @map("invoice_id")  // NEW
  // ...
}
```

Run: `npx prisma migrate dev --name add_notification_invoice_id`

- [ ] **Step 2: Update notification types**

In `src/domains/notification/types.ts`:

```typescript
export type NotificationType =
  | "QUOTE_VIEWED"
  | "QUOTE_APPROVED"
  | "QUOTE_DECLINED"
  | "EVENT_REMINDER"
  | "PAYMENT_FOLLOWUP_SENT"
  | "PAYMENT_DETAILS_RECEIVED"
  | "ACCOUNT_FOLLOWUP_SENT"
  | "ACCOUNT_FOLLOWUP_EXHAUSTED"
  | "ACCOUNT_NUMBER_RECEIVED";

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  quoteId: string | null;
  invoiceId: string | null;  // NEW
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  quoteId?: string;
  invoiceId?: string;  // NEW
}
```

- [ ] **Step 3: Update notification repository to include invoiceId**

In `src/domains/notification/repository.ts`, update the `create` function to pass `invoiceId`, and update `toResponse()` to include `invoiceId`.

- [ ] **Step 4: Fix notification bell routing**

In `src/components/notifications/notification-bell.tsx`, update the click handler at line 39:

```typescript
function handleNotificationClick(notificationId: string, quoteId: string | null, invoiceId: string | null) {
  markRead(notificationId);
  setOpen(false);
  if (invoiceId) {
    router.push(`/invoices/${invoiceId}`);
  } else if (quoteId) {
    router.push(`/quotes/${quoteId}`);
  }
}
```

And update the notification item onClick to pass `invoiceId`:

```tsx
onClick={() => handleNotificationClick(n.id, n.quoteId, n.invoiceId)}
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/domains/notification/ src/components/notifications/notification-bell.tsx
git commit -m "feat: add invoiceId to notifications, fix routing for invoice follow-ups"
```

---

## Task 7: Cron Job — Account Follow-Up Logic

**Files:**
- Create: `src/domains/follow-up/account-follow-ups.ts`
- Create: `tests/domains/follow-up/account-follow-ups.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domains/follow-up/account-follow-ups.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: vi.fn().mockResolvedValue([{ acquired: true }]),
      })
    ),
    followUp: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    invoice: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/sse", () => ({ safePublishAll: vi.fn() }));
vi.mock("@/lib/date-utils", () => ({ businessDaysBetween: vi.fn() }));
vi.mock("@/domains/notification/service", () => ({
  notificationService: { createAndPublish: vi.fn() },
}));
vi.mock("@/domains/follow-up/repository", () => ({
  followUpRepository: {
    findAllActiveSeries: vi.fn(),
    countAttempts: vi.fn(),
    markSeriesStatus: vi.fn(),
    deleteStaleClaimsForSeries: vi.fn(),
    findFreshClaimForSeries: vi.fn(),
    createClaimRow: vi.fn(),
    promoteClaimRow: vi.fn(),
    deleteClaimRow: vi.fn(),
  },
}));

import { checkAndSendAccountFollowUps } from "@/domains/follow-up/account-follow-ups";
import { followUpRepository } from "@/domains/follow-up/repository";
import { businessDaysBetween } from "@/lib/date-utils";
import { sendEmail } from "@/lib/email";

describe("checkAndSendAccountFollowUps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should skip series where invoice already has account number", async () => {
    (followUpRepository.findAllActiveSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        seriesId: "s1",
        invoice: { id: "inv-1", accountNumber: "12345", type: "INVOICE", createdBy: "u1", staff: { email: "a@b.com", name: "A" }, creator: { id: "u1", name: "B" } },
        metadata: { attempt: 1 },
        sentAt: new Date(),
        maxAttempts: 5,
      },
    ]);

    await checkAndSendAccountFollowUps();
    expect(followUpRepository.markSeriesStatus).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should skip if fewer than 5 business days since last send", async () => {
    (followUpRepository.findAllActiveSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        seriesId: "s1",
        invoice: { id: "inv-1", accountNumber: "", type: "INVOICE", createdBy: "u1", staff: { email: "a@b.com", name: "A" }, creator: { id: "u1", name: "B" } },
        metadata: { attempt: 1 },
        sentAt: new Date(),
        maxAttempts: 5,
      },
    ]);
    (businessDaysBetween as ReturnType<typeof vi.fn>).mockReturnValue(3);

    await checkAndSendAccountFollowUps();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should send email and promote claim on successful send", async () => {
    (followUpRepository.findAllActiveSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        seriesId: "s1",
        invoice: {
          id: "inv-1", accountNumber: "", invoiceNumber: "INV-0042", quoteNumber: null,
          type: "INVOICE", description: "Supplies", totalAmount: 100,
          createdBy: "u1", staffId: "staff-1",
          staff: { email: "a@b.com", name: "A" }, creator: { id: "u1", name: "B" },
        },
        metadata: { attempt: 1 },
        sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        maxAttempts: 5,
        shareToken: "tok-1",
      },
    ]);
    (businessDaysBetween as ReturnType<typeof vi.fn>).mockReturnValue(7);
    (followUpRepository.countAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (followUpRepository.findFreshClaimForSeries as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (followUpRepository.createClaimRow as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "claim-1" });
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await checkAndSendAccountFollowUps();
    expect(sendEmail).toHaveBeenCalled();
    expect(followUpRepository.promoteClaimRow).toHaveBeenCalledWith("claim-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domains/follow-up/account-follow-ups.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the cron job logic**

```typescript
// src/domains/follow-up/account-follow-ups.ts
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { businessDaysBetween } from "@/lib/date-utils";
import { safePublishAll } from "@/lib/sse";
import { followUpRepository } from "./repository";
import { buildAccountFollowUpEmail } from "./email-templates";

const FOLLOW_UP_INTERVAL_BUSINESS_DAYS = 5;
const CLAIM_TTL_MINUTES = 30;

export async function checkAndSendAccountFollowUps(): Promise<void> {
  const now = new Date();

  // No global advisory lock needed. Concurrency safety comes from the per-series
  // claim mechanism: each series is protected by the ACCOUNT_FOLLOWUP_CLAIM row
  // with a 30-minute TTL. If two cron runs overlap, the second will see fresh
  // claims and skip. Session-scoped advisory locks are unsafe with Prisma's
  // connection pooling (lock and unlock may hit different pooled connections).
  // The runTrackedJob() wrapper in the caller also provides observability —
  // if the job is already "running" in the JobRun table, operators can see it.

  const activeSeries = await followUpRepository.findAllActiveSeries();
  const appUrl = getAppUrl();

  for (const row of activeSeries) {
    const inv = row.invoice;
    if (!inv) continue;

    // Check if account number was manually entered
    if (inv.accountNumber && inv.accountNumber.trim() !== "") {
      await followUpRepository.markSeriesStatus(row.seriesId!, "COMPLETED");
      safePublishAll({ type: inv.type === "QUOTE" ? "quote-changed" : "invoice-changed" });
      continue;
    }

    // Check cadence
    const daysSince = businessDaysBetween(row.sentAt, now);
    if (daysSince < FOLLOW_UP_INTERVAL_BUSINESS_DAYS) continue;

    // Compute next attempt
    const existingCount = await followUpRepository.countAttempts(row.seriesId!);
    const nextAttempt = existingCount + 1;
    const maxAttempts = row.maxAttempts ?? 5;

    // Safety net: should not happen (exhaustion is immediate after final send)
    if (nextAttempt > maxAttempts) {
      await followUpRepository.markSeriesStatus(row.seriesId!, "EXHAUSTED");
      await notifyExhausted(inv, row.seriesId!);
      continue;
    }

    // Check for existing claims
    const staleThreshold = new Date(now.getTime() - CLAIM_TTL_MINUTES * 60 * 1000);
    const freshClaim = await followUpRepository.findFreshClaimForSeries(row.seriesId!, staleThreshold);
    if (freshClaim) continue; // In-flight

    // Delete stale claims
    await followUpRepository.deleteStaleClaimsForSeries(row.seriesId!, staleThreshold);

    // Recount after stale deletion
    const recountedAttempts = await followUpRepository.countAttempts(row.seriesId!);
    const recountedNext = recountedAttempts + 1;
    if (recountedNext > maxAttempts) {
      await followUpRepository.markSeriesStatus(row.seriesId!, "EXHAUSTED");
      await notifyExhausted(inv, row.seriesId!);
      continue;
    }

    // Find the share token from the initiator row
    const initiator = await prisma.followUp.findFirst({
      where: { seriesId: row.seriesId!, shareToken: { not: null } },
      select: { shareToken: true },
    });
    const shareToken = initiator?.shareToken ?? "";
    const formUrl = `${appUrl}/account-request/${shareToken}`;
    const totalAmount = Number(inv.totalAmount);

    const { subject, html } = buildAccountFollowUpEmail({
      recipientName: inv.staff?.name ?? "Team Member",
      invoiceNumber: inv.invoiceNumber,
      quoteNumber: inv.quoteNumber,
      type: inv.type as "INVOICE" | "QUOTE",
      description: inv.description ?? "",
      totalAmount,
      creatorName: inv.creator?.name ?? "the bookstore",
      formUrl,
      attempt: recountedNext,
      maxAttempts,
    });

    // Create claim
    const claim = await followUpRepository.createClaimRow({
      invoiceId: inv.id,
      seriesId: row.seriesId!,
      shareToken: "", // Only initiator row has the shareToken
      recipientEmail: inv.staff?.email ?? "",
      subject,
      maxAttempts,
      attempt: recountedNext,
    });

    // Send email
    const sent = await sendEmail(inv.staff?.email ?? "", subject, html);
    if (!sent) {
      await followUpRepository.deleteClaimRow(claim.id);
      continue;
    }

    // Promote claim
    await followUpRepository.promoteClaimRow(claim.id);

    // Check if this was the final attempt
    if (recountedNext === maxAttempts) {
      await followUpRepository.markSeriesStatus(row.seriesId!, "EXHAUSTED");
      await notifyExhausted(inv, row.seriesId!);
    } else {
      await notifySent(inv, row.seriesId!, recountedNext, maxAttempts);
    }

    safePublishAll({ type: inv.type === "QUOTE" ? "quote-changed" : "invoice-changed" });
  }
}

function getAppUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://laportal.montalvo.io";
}

type InvoiceInfo = {
  id: string;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: string;
  createdBy: string;
  staff: { email: string; name: string } | null;
  creator: { id: string; name: string } | null;
};

function buildNotificationRef(inv: InvoiceInfo): { quoteId?: string; invoiceId?: string } {
  return inv.type === "QUOTE" ? { quoteId: inv.id } : { invoiceId: inv.id };
}

async function notifySent(inv: InvoiceInfo, _seriesId: string, attempt: number, maxAttempts: number) {
  try {
    const { notificationService } = await import("@/domains/notification/service");
    const docNum = inv.invoiceNumber ?? inv.quoteNumber ?? "item";
    await notificationService.createAndPublish({
      userId: inv.createdBy,
      type: "ACCOUNT_FOLLOWUP_SENT" as import("@/domains/notification/types").NotificationType,
      title: `Follow Up ${attempt}/${maxAttempts} Sent`,
      message: `Follow-up ${attempt} sent for ${docNum} to ${inv.staff?.name ?? "recipient"}`,
      ...buildNotificationRef(inv),
    });
  } catch {
    // Non-critical
  }
}

async function notifyExhausted(inv: InvoiceInfo, _seriesId: string) {
  try {
    const { notificationService } = await import("@/domains/notification/service");
    const docNum = inv.invoiceNumber ?? inv.quoteNumber ?? "item";
    await notificationService.createAndPublish({
      userId: inv.createdBy,
      type: "ACCOUNT_FOLLOWUP_EXHAUSTED" as import("@/domains/notification/types").NotificationType,
      title: "Follow-Ups Complete",
      message: `All follow-ups sent for ${docNum} — no account number received`,
      ...buildNotificationRef(inv),
    });
  } catch {
    // Non-critical
  }
  safePublishAll({ type: inv.type === "QUOTE" ? "quote-changed" : "invoice-changed" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domains/follow-up/account-follow-ups.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domains/follow-up/account-follow-ups.ts tests/domains/follow-up/account-follow-ups.test.ts
git commit -m "feat: add account follow-up cron job with claim pattern"
```

---

## Task 8: Register Cron Job + Job Route

**Files:**
- Modify: `src/instrumentation.ts`
- Modify: `src/lib/job-runs.ts`
- Create: `src/app/api/internal/jobs/account-follow-ups/route.ts`

- [ ] **Step 1: Add job key to KNOWN_JOB_KEYS**

In `src/lib/job-runs.ts`, update line 5:

```typescript
export const KNOWN_JOB_KEYS = ["event-reminders", "payment-follow-ups", "account-follow-ups"] as const;
```

- [ ] **Step 2: Register the cron job in instrumentation.ts**

In `src/instrumentation.ts`, add after the payment follow-ups registration (after line 39):

```typescript
    const { checkAndSendAccountFollowUps } = await import("@/domains/follow-up/account-follow-ups");

    // Account follow-ups — Mondays at 9 AM Los Angeles time
    cron.schedule(
      "0 9 * * 1",
      () => {
        runTrackedJob("account-follow-ups", { runner: "node-cron" }, () => checkAndSendAccountFollowUps()).catch((err) =>
          console.error("[cron] account follow-ups failed:", err)
        );
      },
      { timezone: "America/Los_Angeles" },
    );
```

- [ ] **Step 3: Create the cron API route**

```typescript
// src/app/api/internal/jobs/account-follow-ups/route.ts
import { NextResponse } from "next/server";
import { withCronAuth } from "@/domains/shared/cron";
import { checkAndSendAccountFollowUps } from "@/domains/follow-up/account-follow-ups";
import { runTrackedJob } from "@/lib/job-runs";

export const runtime = "nodejs";

export const POST = withCronAuth(async () => {
  await runTrackedJob("account-follow-ups", { runner: "internal-api" }, () =>
    checkAndSendAccountFollowUps()
  );

  return NextResponse.json({
    ok: true,
    job: "account-follow-ups",
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/instrumentation.ts src/lib/job-runs.ts src/app/api/internal/jobs/account-follow-ups/route.ts
git commit -m "feat: register account follow-up cron job and API route"
```

---

## Task 9: Public API Routes

**Files:**
- Create: `src/app/api/follow-ups/public/[token]/route.ts`
- Create: `src/app/api/follow-ups/public/[token]/submit/route.ts`

- [ ] **Step 1: Create the GET route for fetching summary**

```typescript
// src/app/api/follow-ups/public/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { followUpService } from "@/domains/follow-up/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const summary = await followUpService.getPublicSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(summary);
}
```

- [ ] **Step 2: Create the POST route for submitting account number**

```typescript
// src/app/api/follow-ups/public/[token]/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { followUpService } from "@/domains/follow-up/service";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const rateLimitResult = await checkRateLimit(`account-submit:${ip}`, {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.accountNumber !== "string") {
    return NextResponse.json(
      { error: "accountNumber is required" },
      { status: 400 },
    );
  }

  const result = await followUpService.submitAccountNumber(token, body.accountNumber);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.alreadyResolved) {
    return NextResponse.json({ alreadyResolved: true });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/follow-ups/public/
git commit -m "feat: add public API routes for account number follow-up"
```

---

## Task 10: Initiation API Route

**Files:**
- Create: `src/app/api/follow-ups/initiate/route.ts`

- [ ] **Step 1: Create the authenticated initiation route**

```typescript
// src/app/api/follow-ups/initiate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { followUpService } from "@/domains/follow-up/service";

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.invoiceIds) || body.invoiceIds.length === 0) {
    return NextResponse.json(
      { error: "invoiceIds array is required" },
      { status: 400 },
    );
  }

  if (body.invoiceIds.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 items per request" },
      { status: 400 },
    );
  }

  const result = await followUpService.initiateMultiple(
    body.invoiceIds,
    session.user.id,
    session.user.role === "admin",
  );

  return NextResponse.json(result);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/follow-ups/initiate/route.ts
git commit -m "feat: add authenticated follow-up initiation route"
```

---

## Task 11: Update Middleware for Public Routes

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add public follow-up routes to the middleware matcher exclusion**

In `src/middleware.ts`, update the matcher regex to exclude `api/follow-ups/public` and `account-request/`:

Change the matcher from:
```
"/((?!login|pricing-calculator|textbook-requisitions/submit|api/auth|api/internal|api/setup|api/print-pricing|api/quotes/public|api/textbook-requisitions/(?:submit|lookup)|api/version|quotes/review/[^/]+$|quotes/payment/[^/]+$|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)"
```

To:
```
"/((?!login|pricing-calculator|textbook-requisitions/submit|api/auth|api/internal|api/setup|api/print-pricing|api/quotes/public|api/follow-ups/public|api/textbook-requisitions/(?:submit|lookup)|api/version|quotes/review/[^/]+$|quotes/payment/[^/]+$|account-request/[^/]+$|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)"
```

Two additions:
- `api/follow-ups/public` — for the public API routes
- `account-request/[^/]+$` — for the public form page

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: exclude account follow-up public routes from auth middleware"
```

---

## Task 12: Public Account Request Page

**Files:**
- Create: `src/app/account-request/[token]/page.tsx`

- [ ] **Step 1: Create the public form page**

```tsx
// src/app/account-request/[token]/page.tsx
import { AccountRequestForm } from "@/components/follow-up/account-request-form";

export default async function AccountRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AccountRequestForm token={token} />;
}
```

- [ ] **Step 2: Create the client form component**

```tsx
// src/components/follow-up/account-request-form.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicFollowUpSummary } from "@/domains/follow-up/types";

interface AccountRequestFormProps {
  token: string;
}

export function AccountRequestForm({ token }: AccountRequestFormProps) {
  const [summary, setSummary] = useState<PublicFollowUpSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyResolved, setAlreadyResolved] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/follow-ups/public/${token}`);
      if (!res.ok) {
        setError("This link is invalid or has expired.");
        return;
      }
      const data = await res.json();
      if (data.seriesStatus === "COMPLETED" || data.seriesStatus === "EXHAUSTED") {
        setAlreadyResolved(true);
      }
      setSummary(data);
    } catch {
      setError("Failed to load. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountNumber.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/follow-ups/public/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: accountNumber.trim() }),
      });
      const data = await res.json();

      if (data.alreadyResolved) {
        setAlreadyResolved(true);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-red-600">Link Unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-green-600">Thank You!</h1>
          <p className="mt-2 text-muted-foreground">
            The account number has been submitted successfully. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  if (alreadyResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Already Resolved</h1>
          <p className="mt-2 text-muted-foreground">
            The account number for this request has already been provided. No further action is needed.
          </p>
        </div>
      </div>
    );
  }

  const docLabel = summary!.type === "QUOTE" ? "Quote" : "Invoice";
  const docNumber = summary!.type === "QUOTE" ? summary!.quoteNumber : summary!.invoiceNumber;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Account Number Needed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reminder {summary!.currentAttempt} of {summary!.maxAttempts}
        </p>

        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{docLabel}</span>
            <span className="font-medium">{docNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Description</span>
            <span>{summary!.description}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">${summary!.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contact</span>
            <span>{summary!.creatorName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter your account number"
              required
              maxLength={100}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting || !accountNumber.trim()}>
            {submitting ? "Submitting..." : "Submit Account Number"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Los Angeles Pierce College Bookstore
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/account-request/ src/components/follow-up/account-request-form.tsx
git commit -m "feat: add public account number request page"
```

---

## Task 13: Follow-Up Badge Component

**Files:**
- Create: `src/components/follow-up/follow-up-badge.tsx`

- [ ] **Step 1: Create the badge component**

```tsx
// src/components/follow-up/follow-up-badge.tsx
import { Badge } from "@/components/ui/badge";
import type { FollowUpBadgeState } from "@/domains/follow-up/types";

interface FollowUpBadgeProps {
  state: FollowUpBadgeState | null;
}

export function FollowUpBadge({ state }: FollowUpBadgeProps) {
  if (!state) return null;

  if (state.seriesStatus === "EXHAUSTED") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        No Response
      </Badge>
    );
  }

  if (state.seriesStatus === "ACTIVE") {
    return (
      <Badge className="bg-amber-500 text-[10px] text-white hover:bg-amber-600">
        Follow Up {state.currentAttempt}/{state.maxAttempts}
      </Badge>
    );
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/follow-up/follow-up-badge.tsx
git commit -m "feat: add follow-up badge component"
```

---

## Task 14: Follow-Up Domain — API Client + Hooks

**Files:**
- Create: `src/domains/follow-up/api-client.ts`
- Create: `src/domains/follow-up/hooks.ts`

- [ ] **Step 1: Create the API client**

```typescript
// src/domains/follow-up/api-client.ts
import type {
  InitiateFollowUpResponse,
  FollowUpBadgeState,
} from "./types";

export const followUpApi = {
  async initiate(invoiceIds: string[]): Promise<InitiateFollowUpResponse> {
    const res = await fetch("/api/follow-ups/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error ?? "Request failed");
    }
    return res.json();
  },

  async getBadgeState(invoiceId: string): Promise<FollowUpBadgeState | null> {
    const res = await fetch(`/api/follow-ups/badge?invoiceId=${invoiceId}`);
    if (!res.ok) return null;
    return res.json();
  },

  async getBadgeStatesForInvoices(
    invoiceIds: string[],
  ): Promise<Record<string, FollowUpBadgeState>> {
    if (invoiceIds.length === 0) return {};
    const res = await fetch(
      `/api/follow-ups/badge?invoiceIds=${invoiceIds.join(",")}`,
    );
    if (!res.ok) return {};
    return res.json();
  },

  async getPendingAccounts(): Promise<{
    count: number;
    items: Array<{
      invoiceId: string;
      invoiceNumber: string | null;
      quoteNumber: string | null;
      type: string;
      staffName: string;
      creatorName: string;
      creatorId: string;
      currentAttempt: number;
      maxAttempts: number;
      seriesStatus: string;
    }>;
  }> {
    const res = await fetch("/api/follow-ups/pending");
    if (!res.ok) throw new Error("Failed to fetch pending accounts");
    return res.json();
  },
};
```

- [ ] **Step 2: Create the hooks**

```typescript
// src/domains/follow-up/hooks.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { followUpApi } from "./api-client";
import type { FollowUpBadgeState } from "./types";

export function useFollowUpBadge(invoiceId: string | null) {
  const [badge, setBadge] = useState<FollowUpBadgeState | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const state = await followUpApi.getBadgeState(invoiceId);
      setBadge(state);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { badge, loading, refresh };
}
```

- [ ] **Step 3: Create supporting API routes for badge and pending accounts**

```typescript
// src/app/api/follow-ups/badge/route.ts
// Supports both single-item and batch badge lookups
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { followUpService } from "@/domains/follow-up/service";

export const GET = withAuth(async (req: NextRequest) => {
  // Batch mode: ?invoiceIds=id1,id2,id3
  const invoiceIdsParam = req.nextUrl.searchParams.get("invoiceIds");
  if (invoiceIdsParam) {
    const ids = invoiceIdsParam.split(",").filter(Boolean).slice(0, 100);
    const badges = await followUpService.getBadgeStatesForInvoices(ids);
    return NextResponse.json(badges);
  }

  // Single mode: ?invoiceId=id
  const invoiceId = req.nextUrl.searchParams.get("invoiceId");
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId or invoiceIds required" }, { status: 400 });
  }

  const state = await followUpService.getBadgeState(invoiceId);
  if (!state) {
    return NextResponse.json(null);
  }

  return NextResponse.json(state);
});
```

```typescript
// src/app/api/follow-ups/pending/route.ts
import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { followUpRepository } from "@/domains/follow-up/repository";

export const GET = withAuth(async () => {
  const rows = await followUpRepository.getPendingAccountsSummary();
  const items = rows.map((row) => {
    const attempt = (row.metadata as Record<string, unknown>)?.attempt as number ?? 1;
    return {
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      quoteNumber: row.invoice.quoteNumber,
      type: row.invoice.type,
      staffName: row.invoice.staff?.name ?? "Unknown",
      creatorName: row.invoice.creator?.name ?? "Unknown",
      creatorId: row.invoice.createdBy,
      currentAttempt: attempt,
      maxAttempts: row.maxAttempts ?? 5,
      seriesStatus: row.seriesStatus ?? "ACTIVE",
    };
  });

  return NextResponse.json({ count: items.length, items });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/follow-up/api-client.ts src/domains/follow-up/hooks.ts src/app/api/follow-ups/badge/ src/app/api/follow-ups/pending/
git commit -m "feat: add follow-up API client, hooks, and supporting routes"
```

---

## Task 15: Request Account Number Dialog

**Files:**
- Create: `src/components/follow-up/request-account-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

```tsx
// src/components/follow-up/request-account-dialog.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { followUpApi } from "@/domains/follow-up/api-client";

interface RequestAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  recipientName: string;
  recipientEmail: string;
  onSuccess?: () => void;
}

export function RequestAccountDialog({
  open,
  onOpenChange,
  invoiceId,
  recipientName,
  recipientEmail,
  onSuccess,
}: RequestAccountDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await followUpApi.initiate([invoiceId]);
      const item = result.results[0];
      if (item?.status === "success") {
        toast.success("Account number request sent");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(item?.error ?? "Failed to send request");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Account Number</DialogTitle>
          <DialogDescription>
            A request will be sent now, followed by up to 4 weekly reminders if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recipient</span>
            <span className="font-medium">{recipientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{recipientEmail}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/follow-up/request-account-dialog.tsx
git commit -m "feat: add request account number confirmation dialog"
```

---

## Task 16: Integrate Into Invoice Detail Page

**Files:**
- Modify: `src/components/invoices/invoice-detail-info.tsx`

- [ ] **Step 1: Add the "Request Account Number" button to the invoice detail**

Read the current file to find the exact location where the account number is displayed (the `"Account Number"` label section), then add a button below it when the account number is empty.

Import the new components at the top of the file:

```typescript
import { useState } from "react";
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { RequestAccountDialog } from "@/components/follow-up/request-account-dialog";
import { useFollowUpBadge } from "@/domains/follow-up/hooks";
```

Inside the component, add state and the badge hook:

```typescript
const [requestDialogOpen, setRequestDialogOpen] = useState(false);
const { badge: followUpBadge, refresh: refreshBadge } = useFollowUpBadge(invoice.id);
```

Next to the account number display, add the badge and button:

```tsx
<div className="flex justify-between text-sm">
  <span className="text-[11px] font-medium text-muted-foreground">Account Number</span>
  <div className="flex items-center gap-2">
    <span>{invoice.accountNumber || "—"}</span>
    <FollowUpBadge state={followUpBadge} />
  </div>
</div>
{!invoice.accountNumber && (!followUpBadge || followUpBadge.seriesStatus === "EXHAUSTED") && invoice.staff && (
  <Button
    variant="outline"
    size="sm"
    className="mt-1 w-full text-xs"
    onClick={() => setRequestDialogOpen(true)}
  >
    Request Account Number
  </Button>
)}
{requestDialogOpen && invoice.staff && (
  <RequestAccountDialog
    open={requestDialogOpen}
    onOpenChange={setRequestDialogOpen}
    invoiceId={invoice.id}
    recipientName={invoice.staff.name}
    recipientEmail={invoice.staff.email}
    onSuccess={refreshBadge}
  />
)}
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`

Navigate to an invoice detail page where the account number is empty. Verify the "Request Account Number" button appears.

- [ ] **Step 3: Commit**

```bash
git add src/components/invoices/invoice-detail-info.tsx
git commit -m "feat: add request account number button to invoice detail page"
```

---

## Task 17: Integrate Into Quote Detail Page

**Files:**
- Modify: `src/components/quotes/quote-detail.tsx`

- [ ] **Step 1: Add the same integration as Task 16**

Read the current file, find where account number is displayed, and add the same pattern: `FollowUpBadge`, "Request Account Number" button, and `RequestAccountDialog`. Follow the exact same approach as Task 16 but adapted to the quote detail component's structure and props.

- [ ] **Step 2: Commit**

```bash
git add src/components/quotes/quote-detail.tsx
git commit -m "feat: add request account number button to quote detail page"
```

---

## Task 18: Wire "Needs Account Number" Filter End-to-End

The `needsAccountNumber` filter must be wired through every layer: domain types → api-client → API route → repository. Without this, the UI toggle does nothing on server-paginated lists.

**Files:**
- Modify: `src/domains/invoice/types.ts`
- Modify: `src/domains/invoice/api-client.ts`
- Modify: `src/app/api/invoices/route.ts`
- Modify: `src/domains/invoice/repository.ts`
- Modify: `src/domains/quote/types.ts`
- Modify: `src/domains/quote/api-client.ts`
- Modify: `src/app/api/quotes/route.ts`
- Modify: `src/domains/quote/repository.ts`

- [ ] **Step 1: Add filter field to invoice domain types**

In `src/domains/invoice/types.ts`, add `needsAccountNumber?: boolean` to the `InvoiceFilters` type (around line 107).

- [ ] **Step 2: Serialize filter in invoice api-client**

In `src/domains/invoice/api-client.ts`, add `needsAccountNumber` to the query string serialization (around line 21):

```typescript
if (filters.needsAccountNumber) params.set("needsAccountNumber", "true");
```

- [ ] **Step 3: Parse and apply filter in invoice API route**

In `src/app/api/invoices/route.ts` (around line 31), parse the param:

```typescript
const needsAccountNumber = searchParams.get("needsAccountNumber") === "true";
```

Pass it to the repository query.

- [ ] **Step 4: Add repository query logic for invoice**

In `src/domains/invoice/repository.ts`, when `needsAccountNumber` is true, add a subquery filter that returns only invoices with an active or exhausted `FollowUp` series:

```typescript
if (filters.needsAccountNumber) {
  where.followUps = {
    some: {
      type: { in: ["ACCOUNT_FOLLOWUP", "ACCOUNT_FOLLOWUP_CLAIM"] },
      seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
    },
  };
}
```

- [ ] **Step 5: Repeat steps 1-4 for quote domain**

Apply the same changes to:
- `src/domains/quote/types.ts` — add `needsAccountNumber?: boolean` to quote filters (around line 197)
- `src/domains/quote/api-client.ts` — serialize the param (around line 24)
- `src/app/api/quotes/route.ts` — parse the param (around line 52)
- `src/domains/quote/repository.ts` — add the same `followUps.some` subquery

- [ ] **Step 6: Commit**

```bash
git add src/domains/invoice/types.ts src/domains/invoice/api-client.ts src/app/api/invoices/route.ts src/domains/invoice/repository.ts src/domains/quote/types.ts src/domains/quote/api-client.ts src/app/api/quotes/route.ts src/domains/quote/repository.ts
git commit -m "feat: wire needsAccountNumber filter end-to-end for invoice and quote lists"
```

---

## Task 19: Invoice Table — Badge + Filter + Bulk Action

**Files:**
- Modify: `src/components/invoices/invoice-table.tsx`
- Modify: `src/components/invoices/invoice-filters.tsx`

- [ ] **Step 1: Add "Needs Account Number" filter to InvoiceFilters**

In `src/components/invoices/invoice-filters.tsx`, add a new boolean filter field `needsAccountNumber` to the `InvoiceFilters` interface and add a toggle/chip in the filter bar UI.

- [ ] **Step 2: Integrate badge into invoice table rows**

In `src/components/invoices/invoice-table.tsx`, after fetching invoices, also fetch badge states for all displayed invoice IDs via `GET /api/follow-ups/badge?invoiceIds=id1,id2,...` (the batch mode of the single route from Task 14). Render `FollowUpBadge` in each row alongside the existing status badge.

- [ ] **Step 3: Add bulk "Request Account Numbers" action**

Add checkbox selection to invoice table rows. When selected items all have empty account numbers and no active series, show a "Request Account Numbers" bulk action button. On click, open a `BulkRequestDialog` that calls `followUpApi.initiate(selectedIds)` and displays per-item results with summary.

- [ ] **Step 4: Commit**

```bash
git add src/components/invoices/invoice-table.tsx src/components/invoices/invoice-filters.tsx
git commit -m "feat: add follow-up badges, filter, and bulk action to invoice table"
```

---

## Task 20: Quote Table — Badge + Filter + Bulk Action

**Files:**
- Modify: `src/components/quotes/quote-table.tsx`
- Modify: `src/components/quotes/quote-filters.tsx`

- [ ] **Step 1: Add "Needs Account Number" filter**

In `src/components/quotes/quote-filters.tsx`, add a `needsAccountNumber` boolean filter field to the quote filters interface and add a toggle/chip in the filter bar UI. Same pattern as Task 18 Step 1.

- [ ] **Step 2: Integrate badge into quote table rows**

In `src/components/quotes/quote-table.tsx`, fetch badge states via the batch route (`GET /api/follow-ups/badge?invoiceIds=...`) and render `FollowUpBadge` alongside quote status badges.

- [ ] **Step 3: Add bulk "Request Account Numbers" action**

Same pattern as Task 18 Step 3: checkbox selection, bulk action button, `BulkRequestDialog`.

- [ ] **Step 4: Commit**

```bash
git add src/components/quotes/quote-table.tsx src/components/quotes/quote-filters.tsx
git commit -m "feat: add follow-up badges, filter, and bulk action to quote table"
```

---

## Task 21: Bulk Request Dialog

**Files:**
- Create: `src/components/follow-up/bulk-request-dialog.tsx`

- [ ] **Step 1: Create the bulk dialog component**

```tsx
// src/components/follow-up/bulk-request-dialog.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { followUpApi } from "@/domains/follow-up/api-client";
import type { InitiateFollowUpResult } from "@/domains/follow-up/types";

interface BulkRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceIds: string[];
  onSuccess?: () => void;
}

export function BulkRequestDialog({
  open,
  onOpenChange,
  invoiceIds,
  onSuccess,
}: BulkRequestDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<InitiateFollowUpResult[] | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const response = await followUpApi.initiate(invoiceIds);
      setResults(response.results);
      if (response.summary.failed === 0) {
        toast.success(`${response.summary.succeeded} request(s) sent`);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.warning(
          `${response.summary.succeeded} sent, ${response.summary.failed} failed`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Account Numbers</DialogTitle>
          <DialogDescription>
            Send account number requests for {invoiceIds.length} item(s)?
            Each will receive a request now, followed by up to 4 weekly reminders.
          </DialogDescription>
        </DialogHeader>

        {results && (
          <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
            {results.map((r) => (
              <div key={r.invoiceId} className="flex items-center justify-between">
                <span className="truncate">{r.invoiceId.slice(0, 8)}...</span>
                {r.status === "success" ? (
                  <span className="text-green-600">Sent</span>
                ) : (
                  <span className="text-red-600">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Sending..." : "Send Requests"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/follow-up/bulk-request-dialog.tsx
git commit -m "feat: add bulk request account number dialog"
```

---

## Task 22: Dashboard — Pending Accounts Widget

**Files:**
- Create: `src/components/dashboard/pending-accounts.tsx`
- Modify: `src/components/dashboard/draggable-dashboard.tsx`

- [ ] **Step 1: Create the widget component**

```tsx
// src/components/dashboard/pending-accounts.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { followUpApi } from "@/domains/follow-up/api-client";
import { useSSE } from "@/lib/use-sse";

type PendingItem = {
  invoiceId: string;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: string;
  staffName: string;
  creatorName: string;
  creatorId: string;
  currentAttempt: number;
  maxAttempts: number;
  seriesStatus: string;
};

export function PendingAccountsWidget() {
  const router = useRouter();
  const { data: session } = useSession();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await followUpApi.getPendingAccounts();
      setItems(data.items);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSSE("invoice-changed", fetchData);
  useSSE("quote-changed", fetchData);

  if (loading || items.length === 0) return null;

  const userId = session?.user?.id;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pending Account Numbers</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item) => {
          const docNum = item.type === "QUOTE" ? item.quoteNumber : item.invoiceNumber;
          const href = item.type === "QUOTE" ? `/quotes/${item.invoiceId}` : `/invoices/${item.invoiceId}`;
          const isOwn = item.creatorId === userId;

          return (
            <div
              key={item.invoiceId}
              className={`flex cursor-pointer items-center justify-between rounded-md p-2 text-sm transition-colors hover:bg-muted ${isOwn ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
              onClick={() => router.push(href)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {item.type === "QUOTE" ? "QTE" : "INV"}
                </span>
                <span className="font-medium">{docNum}</span>
                <span className="text-muted-foreground">— {item.staffName}</span>
              </div>
              <FollowUpBadge
                state={{
                  seriesStatus: item.seriesStatus as "ACTIVE" | "EXHAUSTED",
                  currentAttempt: item.currentAttempt,
                  maxAttempts: item.maxAttempts,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the widget to the dashboard layout**

Read `src/components/dashboard/draggable-dashboard.tsx` — this is the actual dashboard composition component (not `src/app/page.tsx`, which only mounts the draggable shell). Add `PendingAccountsWidget` as a new draggable widget in an appropriate position (near YourFocus or after stats cards).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/pending-accounts.tsx src/components/dashboard/draggable-dashboard.tsx
git commit -m "feat: add pending account numbers dashboard widget"
```

---

## Task 23: Recent Activity — Badge Integration

**Files:**
- Modify: `src/components/dashboard/recent-invoices.tsx`

- [ ] **Step 1: Add follow-up badge to activity items**

In `src/components/dashboard/recent-invoices.tsx`, after fetching activity items, also fetch badge states for all displayed invoice/quote IDs. Render `FollowUpBadge` alongside the existing status badge in each activity row.

The activity component already subscribes to `invoice-changed` and `quote-changed` SSE events, so badges will auto-refresh.

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/recent-invoices.tsx
git commit -m "feat: show follow-up badges in recent activity feed"
```

---

## Task 24: Ship Check + Type Check

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`

Expected: No type errors. Fix any that appear.

- [ ] **Step 2: Run ship-check**

Run: `npm run ship-check`

Expected: All checks pass (lint, build, tests).

- [ ] **Step 3: Fix any failures**

Address any lint errors, type errors, or test failures that surfaced.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve ship-check issues for account follow-up feature"
```

---

## Task 25: Update Documentation

**Files:**
- Modify: `docs/PROJECT-OVERVIEW.md`

- [ ] **Step 1: Add Account Number Follow-Up section to PROJECT-OVERVIEW.md**

Add a new section after the "Online Quote Sharing" section describing the feature:

```markdown
## Account Number Follow-Up

Invoices and quotes missing account numbers can be followed up with recurring email requests to the assigned staff member.

### Flow

1. User clicks "Request Account Number" on an invoice/quote detail page (or uses bulk action from the list)
2. Backend persists a follow-up series and sends the first email immediately via Power Automate webhook
3. Email contains a token-based link to a public form where the recipient enters the account number
4. Up to 4 additional weekly reminders are sent by the Monday cron job, with escalating tone
5. Series completes early if the account number is provided (via public form or manual entry)
6. After 5 attempts with no response, the series is marked EXHAUSTED and the creator is notified

### Display

- `FollowUpBadge` component shows "Follow Up 2/5" (amber) or "No Response" (red) alongside existing status badges
- List page filter: "Needs Account Number" shows items with active or exhausted series
- Dashboard widget: "Pending Account Numbers" shows team-wide active/exhausted series
- Recent Activity: badge overlays on existing invoice/quote rows

### Public Routes (no auth)

| Route | Method | Purpose |
|-------|--------|---------|
| `/account-request/[token]` | Page | Public account number form |
| `/api/follow-ups/public/[token]` | GET | Fetch invoice/quote summary |
| `/api/follow-ups/public/[token]/submit` | POST | Submit account number |
```

- [ ] **Step 2: Commit**

```bash
git add docs/PROJECT-OVERVIEW.md
git commit -m "docs: add account number follow-up section to PROJECT-OVERVIEW"
```
