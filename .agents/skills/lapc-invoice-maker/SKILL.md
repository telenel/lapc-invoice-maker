```markdown
# lapc-invoice-maker Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development patterns, coding conventions, and key workflows for contributing to the `lapc-invoice-maker` repository. The project is a TypeScript-based Next.js application for managing invoices, with a modular domain-driven architecture, conventional commit practices, and a focus on maintainable, testable code. You will learn how to extend the database schema, add API endpoints, develop features, refactor domain modules, enhance the admin UI, and build dashboard components, all following established conventions.

## Coding Conventions

### File Naming

- Use **camelCase** for files and folders.
  - Example: `invoiceRepository.ts`, `adminPanel.tsx`

### Import Style

- Use **import aliases** for clarity and maintainability.
  - Example:
    ```typescript
    import { getInvoices } from '@/domains/invoice/repository';
    ```

### Export Style

- **Mixed**: Both named and default exports are used, depending on context.
  - Example (named export):
    ```typescript
    export function createInvoice(data: InvoiceData) { ... }
    ```
  - Example (default export):
    ```typescript
    export default InvoiceList;
    ```

### Commit Messages

- Use **Conventional Commits** with these prefixes: `feat`, `fix`, `docs`, `style`, `chore`, `test`.
- Keep commit messages concise (~58 characters on average).
  - Example: `feat(invoice): add dueDate field to schema`

## Workflows

### Add or Modify Database Table or Field

**Trigger:** When you need to add a new field/table or change the database schema  
**Command:** `/new-table`

1. Edit `prisma/schema.prisma` to define the new table or field.
2. Generate a new migration in `prisma/migrations/` with the appropriate SQL.
   - Example:
     ```bash
     npx prisma migrate dev --name add-due-date-to-invoice
     ```
3. Update backend logic in the relevant repository (`src/domains/*/repository.ts`), service (`src/domains/*/service.ts`), or API routes (`src/app/api/**/*.ts`) to use the new/changed field.
4. Update or add tests as needed.

---

### Add New API Endpoint

**Trigger:** When you want to expose new backend functionality via an API route  
**Command:** `/new-api-endpoint`

1. Create or modify a route handler in `src/app/api/...`.
   - Example: `src/app/api/invoices/[id]/route.ts`
2. Implement or update logic in the corresponding domain's service and/or repository.
3. Update or add types in `src/domains/[domain]/types.ts` if needed.
4. Write or update tests for the new endpoint in `tests/domains/**/*.test.ts`.

---

### Feature Development: Spec, Plan, Implementation

**Trigger:** When adding a significant new feature or workflow  
**Command:** `/new-feature`

1. Write a design spec in `docs/superpowers/specs/`.
2. Write an implementation plan in `docs/superpowers/plans/`.
3. Implement the feature across relevant files (API, domains, components, etc).
4. Update `docs/PROJECT-OVERVIEW.md` and/or `README.md` to reflect changes.

---

### Add or Refactor Domain Module

**Trigger:** When introducing or restructuring a business domain (e.g., staff, invoice, quote, admin)  
**Command:** `/new-domain-module`

1. Create or update:
    - `src/domains/{domain}/repository.ts`
    - `src/domains/{domain}/service.ts`
    - `src/domains/{domain}/api-client.ts`
    - `src/domains/{domain}/hooks.ts`
    - `src/domains/{domain}/types.ts`
2. Update API routes to delegate to the new domain service.
3. Update components to use the new domain api-client and types.
4. Write or update tests for the domain logic.

---

### Add or Update Admin UI CRUD

**Trigger:** When adding or improving admin-facing CRUD features (users, account codes, line items, etc)  
**Command:** `/admin-crud`

1. Create or update API routes under `src/app/api/admin/`.
2. Update or implement domain logic (repository/service) for admin features.
3. Update or add React components in `src/components/admin/` for the UI.
4. Update or add tests for admin logic.

---

### Add Dashboard or Activity Card

**Trigger:** When visualizing new data or activity on the dashboard  
**Command:** `/dashboard-card`

1. Implement or update backend aggregation logic (API route, domain service/repository).
2. Create or update React component(s) for the dashboard card in `src/components/dashboard/`.
3. Wire the new card into `src/app/page.tsx` (dashboard).
4. Update types if needed.

---

## Testing Patterns

- **Framework:** [vitest](https://vitest.dev/)
- **Test File Pattern:** `*.test.ts`
- **Location:** Typically under `tests/domains/` or alongside domain files.
- **Example:**
  ```typescript
  // tests/domains/invoice/invoiceRepository.test.ts
  import { describe, it, expect } from 'vitest';
  import { getInvoices } from '@/domains/invoice/repository';

  describe('getInvoices', () => {
    it('returns invoices for a user', async () => {
      const invoices = await getInvoices({ userId: 1 });
      expect(invoices).toBeInstanceOf(Array);
    });
  });
  ```

## Commands

| Command            | Purpose                                                      |
|--------------------|--------------------------------------------------------------|
| /new-table         | Add or modify a database table or field                      |
| /new-api-endpoint  | Add a new API endpoint                                       |
| /new-feature       | Start a new feature with spec, plan, and implementation      |
| /new-domain-module | Add or refactor a domain module                              |
| /admin-crud        | Add or update admin panel CRUD functionality                 |
| /dashboard-card    | Add a dashboard or activity visualization card               |
```
