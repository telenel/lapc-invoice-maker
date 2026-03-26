---
name: create-migration
description: Create a Prisma 7 database migration with correct adapter pattern, client generation, and import validation
disable-model-invocation: true
---

# Create Prisma 7 Migration

Follow these steps exactly when creating a database migration.

## Prerequisites

- The dev database must be running (`docker compose up db` or local PostgreSQL)
- The `.env` file must have a valid `DATABASE_URL`

## Steps

### 1. Edit the schema

Modify `prisma/schema.prisma` as needed. Remember:
- All models use `@@map("snake_case_table_name")`
- All fields use `@map("snake_case_column_name")` where the field name differs
- Decimal fields use `@db.Decimal(10, 2)`
- UUIDs via `@id @default(uuid())`
- Timestamps: `createdAt DateTime @default(now()) @map("created_at")` and `updatedAt DateTime @updatedAt @map("updated_at")`

### 2. Generate and run the migration

```bash
cd ~/lapc-invoice-maker
npx prisma migrate dev --name <descriptive-name>
```

This generates the migration SQL in `prisma/migrations/` AND regenerates the client.

### 3. Verify the client output

After migration, confirm the generated client exists:

```bash
ls src/generated/prisma/client
```

### 4. Verify imports

All Prisma client imports in this project MUST use:

```typescript
import { PrismaClient } from "@/generated/prisma/client"
```

**NOT** `@prisma/client`. Search the codebase if you added new files:

```bash
grep -r "from '@prisma/client'" src/ --include="*.ts" --include="*.tsx"
grep -r 'from "@prisma/client"' src/ --include="*.ts" --include="*.tsx"
```

If any results appear, fix them to use `@/generated/prisma/client`.

### 5. Verify Decimal handling

If you added or modified `Decimal` fields, ensure all code that reads them wraps with `Number()` before calling `.toFixed()` or doing arithmetic:

```typescript
// CORRECT
const amount = Number(invoice.totalAmount).toFixed(2)

// WRONG - will fail at runtime
const amount = invoice.totalAmount.toFixed(2)
```

### 6. Test

```bash
npm run build
npm test
```
