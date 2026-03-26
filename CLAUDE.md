# LAPC InvoiceMaker

Invoice generation webapp for Los Angeles Pierce College. Next.js 14 (App Router), Prisma 7, PostgreSQL, Tailwind CSS 4, shadcn/ui v4.

## Stack Gotchas

### Prisma 7
- Client imports: `import { PrismaClient } from "@/generated/prisma/client"` — NOT `@prisma/client`
- Constructor: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
- Decimal fields come back as strings — always `Number(field)` before `.toFixed()` or arithmetic
- Schema config lives in `prisma.config.ts` (uses dotenv for datasource URL)
- Standalone scripts need `import "dotenv/config"` and the PrismaPg adapter

### shadcn/ui v4 (base-ui)
- Uses base-ui, NOT Radix — no `asChild` prop, no `buttonVariants` in server components
- Component imports from `@/components/ui/*`

### PDF Generation
- Puppeteer renders HTML templates to PDF, pdf-lib merges pages
- Templates in `src/lib/pdf/templates/` — all styles inline (no Tailwind in Puppeteer)
- Logo loaded as base64 data URI from `public/lapc-logo.png`
- Cover sheet: portrait Letter, IDP: landscape 11x8.5in

## Project Structure

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components (ui/, invoice/, staff/, etc.)
├── generated/     # Prisma generated client (do not edit)
└── lib/           # Utilities, auth, PDF generation
prisma/
├── schema.prisma  # Database schema
├── migrations/    # Migration history
└── seed.ts        # Database seeding
scripts/           # One-off scripts (staff import, etc.)
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (also type-checks)
npm run lint         # ESLint
npm test             # Vitest (run all tests)
npm run test:watch   # Vitest watch mode
npx prisma migrate dev --name <name>   # Create migration
npx prisma generate  # Regenerate client after schema changes
```

## Deployment

Docker Compose on montalvo.io behind Traefik. CI/CD via GitHub Actions — push to main triggers lint, build, test, then SSH deploy.

## Conventions

- All Prisma models: `@@map("snake_case_table")`, fields: `@map("snake_case_column")`
- Files: kebab-case. Components: PascalCase
- API routes: validate with Zod, check `getServerSession()`, return `NextResponse`
- Account Number and Account Code are separate fields — don't conflate them
