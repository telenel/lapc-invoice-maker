# Codebase Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Decimal handling bugs, add try/catch to all API routes, add Zod validation to unvalidated endpoints, add path traversal protection, add a global error boundary, and add toast feedback for silent error catches.

**Architecture:** Bottom-up fixes — start with the data layer (Decimal safety in API routes), then add error handling (try/catch wrappers), then validation (Zod schemas for missing endpoints), then security (path traversal), then UI resilience (error boundary, toast notifications). Each task is independent and can be committed separately.

**Tech Stack:** Next.js 14 (App Router), Prisma 7, Zod, shadcn/ui v4, Sonner (toast), TypeScript

---

## Task 1: Fix Decimal Arithmetic in API Routes

Server-side invoice total calculations use raw `item.quantity * item.unitPrice` on values coming from Zod-parsed request bodies. These are already `number` types from Zod parsing, so the server-side POST/PUT routes are actually safe. However, wrap them in `Number()` defensively for consistency with the codebase convention.

**Files:**
- Modify: `src/app/api/invoices/route.ts:96-100`
- Modify: `src/app/api/invoices/[id]/route.ts:67-70`

- [ ] **Step 1: Fix `src/app/api/invoices/route.ts` POST handler**

In the POST handler, replace the calculation block:

```typescript
// Before (lines ~96-100):
const calculatedItems = items.map((item) => {
  const extendedPrice = item.quantity * item.unitPrice;
  return { ...item, extendedPrice };
});
const totalAmount = calculatedItems.reduce((sum, item) => sum + item.extendedPrice, 0);

// After:
const calculatedItems = items.map((item) => {
  const extendedPrice = Number(item.quantity) * Number(item.unitPrice);
  return { ...item, extendedPrice };
});
const totalAmount = calculatedItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
```

- [ ] **Step 2: Fix `src/app/api/invoices/[id]/route.ts` PUT handler**

In the PUT handler, replace the calculation block:

```typescript
// Before (lines ~67-70):
const calculatedItems = items.map((item) => {
  const extendedPrice = item.quantity * item.unitPrice;
  return { ...item, extendedPrice };
});
const totalAmount = calculatedItems.reduce((sum, item) => sum + item.extendedPrice, 0);

// After:
const calculatedItems = items.map((item) => {
  const extendedPrice = Number(item.quantity) * Number(item.unitPrice);
  return { ...item, extendedPrice };
});
const totalAmount = calculatedItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All 121 tests pass (no behavioral change — defensive wrapping only)

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Clean build, no type errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/invoices/route.ts src/app/api/invoices/\[id\]/route.ts
git commit -m "fix: wrap Decimal fields in Number() for API route calculations"
```

---

## Task 2: Fix Decimal Display in UI Components

Client-side components call `.toFixed()` on values that may come from API responses as strings (Prisma Decimal). Also fix the client-side arithmetic in `invoice-form.tsx`.

**Files:**
- Modify: `src/components/invoice/invoice-form.tsx:170,198`
- Modify: `src/components/invoice/line-items.tsx:227,265`
- Modify: `src/components/invoice/wizard-mode.tsx:446,452`
- Modify: `src/components/invoice/quick-pick-panel.tsx:85,108`

- [ ] **Step 1: Fix `invoice-form.tsx` — arithmetic in updateItem and total**

Line 170 — wrap the multiplication:
```typescript
// Before:
updated.extendedPrice = updated.quantity * updated.unitPrice;
// After:
updated.extendedPrice = Number(updated.quantity) * Number(updated.unitPrice);
```

Line 198 — wrap the reduce:
```typescript
// Before:
() => form.items.reduce((sum, item) => sum + item.extendedPrice, 0),
// After:
() => form.items.reduce((sum, item) => sum + Number(item.extendedPrice), 0),
```

- [ ] **Step 2: Fix `line-items.tsx` — .toFixed() calls**

Line 227 — wrap extendedPrice:
```typescript
// Before:
value={`$${item.extendedPrice.toFixed(2)}`}
// After:
value={`$${Number(item.extendedPrice).toFixed(2)}`}
```

Line 265 — wrap total:
```typescript
// Before:
Total: ${total.toFixed(2)}
// After:
Total: ${Number(total).toFixed(2)}
```

- [ ] **Step 3: Fix `wizard-mode.tsx` — review summary .toFixed() calls**

Line 446:
```typescript
// Before:
${item.extendedPrice.toFixed(2)}
// After:
${Number(item.extendedPrice).toFixed(2)}
```

Line 452:
```typescript
// Before:
${total.toFixed(2)}
// After:
${Number(total).toFixed(2)}
```

- [ ] **Step 4: Fix `quick-pick-panel.tsx` — display prices**

Line 85:
```typescript
// Before:
{pick.description} — ${pick.price.toFixed(2)}
// After:
{pick.description} — ${Number(pick.price).toFixed(2)}
```

Line 108:
```typescript
// Before:
{item.description} — ${item.unitPrice.toFixed(2)}
// After:
{item.description} — ${Number(item.unitPrice).toFixed(2)}
```

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: All tests pass, clean build

- [ ] **Step 6: Commit**

```bash
git add src/components/invoice/invoice-form.tsx src/components/invoice/line-items.tsx src/components/invoice/wizard-mode.tsx src/components/invoice/quick-pick-panel.tsx
git commit -m "fix: wrap Decimal values in Number() for UI display and arithmetic"
```

---

## Task 3: Add try/catch to All API Routes

Wrap all Prisma queries in try/catch blocks. Return structured 500 errors with `console.error` logging. Apply to every route that currently lacks error handling.

**Files:**
- Modify: `src/app/api/invoices/route.ts` (GET handler)
- Modify: `src/app/api/invoices/[id]/route.ts` (GET, PUT, DELETE)
- Modify: `src/app/api/invoices/[id]/finalize/route.ts` (POST)
- Modify: `src/app/api/invoices/[id]/pdf/route.ts` (already has try/catch — no change)
- Modify: `src/app/api/invoices/export/route.ts` (GET)
- Modify: `src/app/api/staff/route.ts` (GET, POST)
- Modify: `src/app/api/staff/[id]/route.ts` (GET, PUT, PATCH, DELETE)
- Modify: `src/app/api/staff/[id]/account-numbers/route.ts` (GET, POST)
- Modify: `src/app/api/categories/route.ts` (GET, POST)
- Modify: `src/app/api/categories/[id]/route.ts` (PUT, DELETE)
- Modify: `src/app/api/quick-picks/route.ts` (GET, POST)
- Modify: `src/app/api/quick-picks/[id]/route.ts` (PUT, DELETE)
- Modify: `src/app/api/saved-items/route.ts` (GET, POST)
- Modify: `src/app/api/analytics/route.ts` (GET)
- Modify: `src/app/api/upload/route.ts` (POST)
- Modify: `src/app/api/admin/users/route.ts` (GET, POST)
- Modify: `src/app/api/admin/users/[id]/route.ts` (PUT, DELETE)

The pattern for each handler is the same. Wrap the body after auth check in try/catch:

```typescript
try {
  // ... existing handler body ...
} catch (err) {
  console.error("POST /api/example failed:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

For routes that already have a try/catch for specific errors (like `invoices/route.ts` POST with P2002 handling), wrap the outer handler and re-throw known errors to keep existing behavior.

- [ ] **Step 1: Add try/catch to `src/app/api/invoices/route.ts` GET**

Wrap the entire GET body (after auth check) in try/catch. The POST handler already has a try/catch — wrap the outer part (the `calculatedItems` and pre-create logic) so the entire handler is covered.

- [ ] **Step 2: Add try/catch to `src/app/api/invoices/[id]/route.ts` GET, PUT, DELETE**

Each of the three handlers needs wrapping after the auth check.

- [ ] **Step 3: Add try/catch to `src/app/api/invoices/[id]/finalize/route.ts` POST**

Wrap the entire POST body after auth check. This is the most complex handler (PDF generation + multiple DB writes).

- [ ] **Step 4: Add try/catch to `src/app/api/invoices/export/route.ts` GET**

Wrap after auth check.

- [ ] **Step 5: Add try/catch to `src/app/api/staff/route.ts` GET and POST**

Wrap both handlers.

- [ ] **Step 6: Add try/catch to `src/app/api/staff/[id]/route.ts` GET, PUT, PATCH, DELETE**

Wrap all four handlers.

- [ ] **Step 7: Add try/catch to `src/app/api/staff/[id]/account-numbers/route.ts` GET and POST**

Wrap both handlers.

- [ ] **Step 8: Add try/catch to `src/app/api/categories/route.ts` GET and POST**

Wrap both handlers.

- [ ] **Step 9: Add try/catch to `src/app/api/categories/[id]/route.ts` PUT and DELETE**

Wrap both handlers.

- [ ] **Step 10: Add try/catch to `src/app/api/quick-picks/route.ts` GET and POST**

Wrap both handlers.

- [ ] **Step 11: Add try/catch to `src/app/api/quick-picks/[id]/route.ts` PUT and DELETE**

Wrap both handlers.

- [ ] **Step 12: Add try/catch to `src/app/api/saved-items/route.ts` GET and POST**

Wrap both handlers.

- [ ] **Step 13: Add try/catch to `src/app/api/analytics/route.ts` GET**

Wrap after auth check.

- [ ] **Step 14: Add try/catch to `src/app/api/upload/route.ts` POST**

Wrap after auth check.

- [ ] **Step 15: Add try/catch to `src/app/api/admin/users/route.ts` GET and POST**

Wrap both handlers.

- [ ] **Step 16: Add try/catch to `src/app/api/admin/users/[id]/route.ts` PUT and DELETE**

Wrap both handlers.

- [ ] **Step 17: Run tests and build**

Run: `npm test && npm run build`
Expected: All tests pass, clean build

- [ ] **Step 18: Commit**

```bash
git add src/app/api/
git commit -m "fix: add try/catch error handling to all API route handlers"
```

---

## Task 4: Add Zod Validation to Unvalidated Endpoints

Four endpoint groups currently use manual validation or `as` type assertions instead of Zod schemas.

**Files:**
- Modify: `src/lib/validators.ts` (add new schemas)
- Modify: `src/app/api/categories/route.ts` (POST)
- Modify: `src/app/api/categories/[id]/route.ts` (PUT)
- Modify: `src/app/api/staff/[id]/account-numbers/route.ts` (POST)
- Modify: `src/app/api/admin/users/route.ts` (POST)
- Modify: `src/app/api/admin/users/[id]/route.ts` (PUT)
- Test: `tests/lib/validators.test.ts`

- [ ] **Step 1: Add new Zod schemas to `src/lib/validators.ts`**

Add after the existing `savedLineItemSchema`:

```typescript
export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  label: z.string().min(1, "Label is required"),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const staffAccountNumberSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  description: z.string().optional().default(""),
});

export const adminUserCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["user", "admin"]).optional(),
});
```

- [ ] **Step 2: Write tests for the new schemas**

Add to `tests/lib/validators.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// categoryCreateSchema
// ---------------------------------------------------------------------------
describe("categoryCreateSchema", () => {
  it("accepts valid category", () => {
    const result = categoryCreateSchema.safeParse({ name: "SUPPLIES", label: "Supplies" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = categoryCreateSchema.safeParse({ name: "", label: "Supplies" });
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = categoryCreateSchema.safeParse({ name: "SUPPLIES", label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = categoryCreateSchema.safeParse({ label: "Supplies" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// categoryUpdateSchema
// ---------------------------------------------------------------------------
describe("categoryUpdateSchema", () => {
  it("accepts partial update with just name", () => {
    const result = categoryUpdateSchema.safeParse({ name: "NEW_NAME" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = categoryUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts sortOrder as integer", () => {
    const result = categoryUpdateSchema.safeParse({ sortOrder: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects sortOrder as float", () => {
    const result = categoryUpdateSchema.safeParse({ sortOrder: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts active boolean", () => {
    const result = categoryUpdateSchema.safeParse({ active: false });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// staffAccountNumberSchema
// ---------------------------------------------------------------------------
describe("staffAccountNumberSchema", () => {
  it("accepts valid account number", () => {
    const result = staffAccountNumberSchema.safeParse({ accountCode: "ACC-001" });
    expect(result.success).toBe(true);
  });

  it("accepts with description", () => {
    const result = staffAccountNumberSchema.safeParse({ accountCode: "ACC-001", description: "Main account" });
    expect(result.success).toBe(true);
  });

  it("rejects empty accountCode", () => {
    const result = staffAccountNumberSchema.safeParse({ accountCode: "" });
    expect(result.success).toBe(false);
  });

  it("defaults description to empty string", () => {
    const result = staffAccountNumberSchema.safeParse({ accountCode: "ACC-001" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// adminUserCreateSchema
// ---------------------------------------------------------------------------
describe("adminUserCreateSchema", () => {
  it("accepts valid user with name only", () => {
    const result = adminUserCreateSchema.safeParse({ name: "John Doe" });
    expect(result.success).toBe(true);
  });

  it("accepts with valid email", () => {
    const result = adminUserCreateSchema.safeParse({ name: "John", email: "john@example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts empty string email", () => {
    const result = adminUserCreateSchema.safeParse({ name: "John", email: "" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = adminUserCreateSchema.safeParse({ name: "John", email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = adminUserCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// adminUserUpdateSchema
// ---------------------------------------------------------------------------
describe("adminUserUpdateSchema", () => {
  it("accepts empty object", () => {
    const result = adminUserUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid role", () => {
    const result = adminUserUpdateSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = adminUserUpdateSchema.safeParse({ role: "superadmin" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify new schemas**

Run: `npm test`
Expected: New tests pass alongside existing 121 tests

- [ ] **Step 4: Update `src/app/api/categories/route.ts` POST to use Zod**

```typescript
import { categoryCreateSchema } from "@/lib/validators";

// In POST handler, replace manual validation with:
const parsed = categoryCreateSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
const category = await prisma.category.create({ data: parsed.data });
```

- [ ] **Step 5: Update `src/app/api/categories/[id]/route.ts` PUT to use Zod**

```typescript
import { categoryUpdateSchema } from "@/lib/validators";

// In PUT handler, replace raw destructuring with:
const parsed = categoryUpdateSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
const category = await prisma.category.update({
  where: { id: params.id },
  data: parsed.data,
});
```

- [ ] **Step 6: Update `src/app/api/staff/[id]/account-numbers/route.ts` POST to use Zod**

```typescript
import { staffAccountNumberSchema } from "@/lib/validators";

// In POST handler, replace type assertion with:
const parsed = staffAccountNumberSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
const { accountCode, description } = parsed.data;
```

- [ ] **Step 7: Update `src/app/api/admin/users/route.ts` POST to use Zod**

```typescript
import { adminUserCreateSchema } from "@/lib/validators";

// In POST handler, replace manual validation with:
const parsed = adminUserCreateSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
const { name, email } = parsed.data;
```

- [ ] **Step 8: Update `src/app/api/admin/users/[id]/route.ts` PUT to use Zod**

```typescript
import { adminUserUpdateSchema } from "@/lib/validators";

// In PUT handler, replace raw destructuring with:
const parsed = adminUserUpdateSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
const user = await prisma.user.update({
  where: { id: params.id },
  data: parsed.data,
});
```

- [ ] **Step 9: Run tests and build**

Run: `npm test && npm run build`
Expected: All tests pass, clean build

- [ ] **Step 10: Commit**

```bash
git add src/lib/validators.ts tests/lib/validators.test.ts src/app/api/categories/ src/app/api/staff/\[id\]/account-numbers/ src/app/api/admin/
git commit -m "feat: add Zod validation to categories, account numbers, and admin user endpoints"
```

---

## Task 5: Add Path Traversal Protection to Invoice Deletion

The DELETE handler in `invoices/[id]/route.ts` uses `invoice.prismcorePath` from the database to delete a file. Validate the resolved path stays within the allowed directory.

**Files:**
- Modify: `src/app/api/invoices/[id]/route.ts:131-137`

- [ ] **Step 1: Add path validation to prismcore file deletion**

Replace the prismcore deletion block:

```typescript
// Before:
if (invoice.prismcorePath) {
  try {
    const prismcoreFullPath = path.resolve(process.cwd(), "public", invoice.prismcorePath);
    await unlink(prismcoreFullPath);
  } catch {
    // File may not exist on disk — ignore
  }
}

// After:
if (invoice.prismcorePath) {
  try {
    const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
    const prismcoreFullPath = path.resolve(process.cwd(), "public", invoice.prismcorePath);
    if (prismcoreFullPath.startsWith(uploadsDir + path.sep)) {
      await unlink(prismcoreFullPath);
    }
  } catch {
    // File may not exist on disk — ignore
  }
}
```

- [ ] **Step 2: Run tests and build**

Run: `npm test && npm run build`
Expected: All tests pass, clean build

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/\[id\]/route.ts
git commit -m "fix: prevent path traversal in invoice file deletion"
```

---

## Task 6: Add Next.js Global Error Boundary

Create `src/app/error.tsx` for the App Router global error boundary and `src/app/global-error.tsx` for root layout errors.

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/global-error.tsx`

- [ ] **Step 1: Create `src/app/error.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/global-error.tsx`**

```tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ fontSize: "0.875rem", color: "#666", maxWidth: "28rem", textAlign: "center" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #ccc", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build with new error pages

- [ ] **Step 4: Commit**

```bash
git add src/app/error.tsx src/app/global-error.tsx
git commit -m "feat: add global error boundary for unhandled errors"
```

---

## Task 7: Add Toast Feedback for PrismCore Upload Failures

The `PrismcoreUpload` component silently swallows upload errors. Add a toast notification.

**Files:**
- Modify: `src/components/invoice/prismcore-upload.tsx:37-38`

- [ ] **Step 1: Add toast import and error notification**

Add import at top:
```typescript
import { toast } from "sonner";
```

Replace the catch block:
```typescript
// Before:
} catch {
  // Reset on failure
  if (inputRef.current) inputRef.current.value = "";
}

// After:
} catch {
  toast.error("Failed to upload PrismCore PDF. Please try again.");
  if (inputRef.current) inputRef.current.value = "";
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add src/components/invoice/prismcore-upload.tsx
git commit -m "fix: show toast notification on PrismCore upload failure"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (original 121 + new validator tests)

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Clean production build

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No warnings or errors
