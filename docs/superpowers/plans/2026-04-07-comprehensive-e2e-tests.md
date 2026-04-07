# Comprehensive Playwright E2E Test Plan for LAPortal

## Prompt for New Claude Session

Copy this into a new Claude Code session:

---

I need you to create comprehensive Playwright E2E tests for LAPortal. The project is at `/Users/montalvo/lapc-invoice-maker`.

**Context:**
- Playwright is already installed (`@playwright/test` in devDependencies)
- Config is at `playwright.config.ts` (chromium, baseURL localhost:3000)
- 3 test files already exist in `e2e/` for the textbook requisition feature
- `vitest.config.ts` already excludes `**/e2e/**`
- The app runs on Next.js 14 App Router with NextAuth credentials auth
- Database is Supabase Postgres (may need `/etc/hosts` entry for IPv6 — check if `db.wzhuuhxzxrzyasxvuagb.supabase.co` resolves)

**Read these files first:**
- `docs/PROJECT-OVERVIEW.md` — full feature inventory
- `playwright.config.ts` — existing config
- `e2e/requisition-api.spec.ts` — example of API-level tests
- `e2e/requisition-public-submit.spec.ts` — example of browser tests
- `src/middleware.ts` — which routes are public vs authenticated
- `src/components/nav.tsx` — all nav links (= all features to test)

**Auth setup needed:**
Create `e2e/auth.setup.ts` that logs in via the login page and saves the auth state to `e2e/.auth/user.json`. Then configure `playwright.config.ts` to use this as a setup project so all authenticated tests get a real session. Use credentials from `.env` or environment variables (`E2E_USERNAME`, `E2E_PASSWORD`).

**Test suites to create:**

### 1. `e2e/auth.spec.ts` — Login/Logout
- Login page renders
- Invalid credentials show error
- Valid login redirects to dashboard
- Logout returns to login
- Unauthenticated access redirects to login

### 2. `e2e/dashboard.spec.ts` — Dashboard
- Renders personalized greeting
- Stats cards show numbers
- Recent activity loads
- Nav links are all present and clickable
- Dashboard widgets render

### 3. `e2e/invoices.spec.ts` — Invoice CRUD
- List page loads with table
- Filter by status, department, search
- Create new invoice (fill form, add line items, save as draft)
- View invoice detail
- Edit invoice
- Finalize invoice (generates PDF)
- CSV export downloads

### 4. `e2e/quotes.spec.ts` — Quote Workflow
- List page loads
- Create new quote with line items
- Mark as sent (generates share link)
- Public quote page accessible without auth (`/quotes/review/[token]`)
- Accept/decline from public page
- Quote revision workflow
- Convert quote to invoice

### 5. `e2e/staff.spec.ts` — Staff Management
- List page with search
- Create new staff member
- Edit staff details
- Account numbers management

### 6. `e2e/calendar.spec.ts` — Calendar
- Calendar renders with FullCalendar
- Create a manual event
- Edit event
- Delete event
- Event types render with correct colors

### 7. `e2e/analytics.spec.ts` — Analytics
- Page loads
- Charts render (check for SVG/canvas elements)
- Date range filter works

### 8. `e2e/admin.spec.ts` — Admin Panel
- Settings page loads with tabs
- Users tab shows user list
- Categories tab works
- Account numbers tab works

### 9. `e2e/requisitions.spec.ts` — Textbook Requisitions (full flow)
- Authenticated list page with stats
- Create requisition internally
- View detail with all sections
- Mark Ordered + Email notification
- Mark On-Shelf + Email notification
- Edit requisition (status dropdown should NOT be present)
- Archive (soft delete) requisition
- CSV export
- Filter by status/term/year

### 10. `e2e/public-pages.spec.ts` — All Public Routes
- `/textbook-requisitions/submit` — faculty form works without auth
- `/pricing-calculator` — print shop calculator works without auth
- `/quotes/review/[token]` — public quote page (needs a valid token)

**Important conventions:**
- Use `page.locator("#id")` or `page.getByRole()` for selectors — avoid fragile CSS selectors
- Each test file should be independent (no cross-file dependencies)
- Use `test.describe.serial()` for tests that must run in order
- Rate limiting exists on public endpoints — tests that hit the submit API repeatedly may get 429'd
- Authenticated tests use the shared auth state from `auth.setup.ts`
- Keep tests under 30s each (the default timeout)
- Add `test-results/` and `e2e/.auth/` to `.gitignore`

**Run with:** `npx playwright test`
**Run specific suite:** `npx playwright test e2e/invoices.spec.ts`

After writing all tests, run them locally, fix any selector issues, then commit and push.

---
