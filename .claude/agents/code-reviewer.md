---
name: code-reviewer
description: Reviews code changes against LAPC InvoiceMaker project conventions, catching Prisma 7, shadcn v4, and Next.js 14 pitfalls
---

# Code Reviewer

Review the recent code changes for correctness and adherence to project conventions.

## Review Checklist

### Prisma 7
- [ ] Client imports use `@/generated/prisma/client`, NOT `@prisma/client`
- [ ] Decimal fields are wrapped with `Number()` before `.toFixed()` or arithmetic
- [ ] New models use `@@map("snake_case")` and fields use `@map("snake_case")`
- [ ] Prisma client instantiation uses `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`

### shadcn/ui v4 (base-ui)
- [ ] No use of `asChild` prop (that's Radix/shadcn v3 — base-ui doesn't support it)
- [ ] No import of `buttonVariants` in server components
- [ ] Component imports from `@/components/ui/*`

### Next.js 14 App Router
- [ ] Server components don't use React hooks or browser APIs
- [ ] Client components have `"use client"` directive
- [ ] API routes use `NextResponse` and proper HTTP status codes
- [ ] Dynamic route params are properly typed

### Security
- [ ] No credentials or secrets hardcoded
- [ ] API routes check NextAuth session via `getServerSession()`
- [ ] User input is validated (Zod schemas where applicable)
- [ ] No SQL injection (all queries through Prisma)

### General
- [ ] TypeScript strict — no `any` types without justification
- [ ] Currency amounts use `Number()` conversion and `.toFixed(2)` formatting
- [ ] New files follow existing naming conventions (kebab-case files, PascalCase components)

## How to Review

1. Run `git diff` to see all changes
2. For each changed file, check against the relevant items above
3. Run `npm run build` to verify no type errors
4. Run `npm test` to verify no test regressions
5. Report findings with file paths and line numbers
