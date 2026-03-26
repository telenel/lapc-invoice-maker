---
name: gen-pdf-template
description: Create or modify Puppeteer HTML-to-PDF templates following the project's cover sheet and IDP patterns
disable-model-invocation: true
---

# PDF Template Development

This project generates invoices as PDFs using Puppeteer (HTML-to-PDF) and pdf-lib (merging). Follow these conventions.

## Architecture

```
src/lib/pdf/
├── generate.ts          # Orchestrator: launches Puppeteer, renders templates, merges pages
├── merge.ts             # PrismCore PDF insertion via pdf-lib
└── templates/
    ├── cover-sheet.ts   # Page 1: memo-style cover sheet (portrait Letter)
    └── idp.ts           # Page 2+: IDP form (landscape 11x8.5in)
```

- Each template exports a `render*()` function that returns an HTML string
- Each template exports a TypeScript interface for its data
- `generate.ts` handles Puppeteer lifecycle, logo loading (base64 data URI), and pdf-lib merging

## Template Conventions

### Logo Loading
The logo is loaded in `generate.ts` as a base64 data URI and passed to templates:
```typescript
const logoBuffer = await fs.readFile(path.join(process.cwd(), "public/lapc-logo.png"))
const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`
```
Templates receive `logoBase64` as a parameter — never use file:// URLs or external references.

### CSS and Styling
- All styles go in an inline `<style>` block inside the HTML string — no external stylesheets
- Use `@page` CSS rule for page size and margins
- Portrait (cover sheet): `@page { size: Letter; margin: 0.75in 1in; }`
- Landscape (IDP): `@page { size: 11in 8.5in; margin: 0.25in; }`
- Use standard CSS (flexbox, tables) — no Tailwind (Puppeteer doesn't have it)

### Puppeteer Rendering
Templates are rendered in `generate.ts` via:
```typescript
await page.setContent(html, { waitUntil: "networkidle0" })
const pdfBuffer = await page.pdf({ format: "Letter", printBackground: true })
```
- Always use `printBackground: true` for background colors/images
- Use `waitUntil: "networkidle0"` to ensure fonts/images load

### Color Palette
- Header accent: `#c00` (red bottom border)
- IDP sidebar: `#CCFFCC` (light green)
- Table borders: `#000` (black, 1px solid)
- Text: `#000` (black)

### IDP-Specific Patterns
- Green sidebars use `writing-mode: vertical-rl` with `transform: rotate(180deg)` for vertical text
- Item tables pad to minimum 4 rows with empty rows for consistent layout
- Column widths: description 55%, quantity 10%, unit price 17%, extended price 18%

## When Modifying Templates

1. Read the existing template file first
2. Make changes to the HTML/CSS in the template function
3. Test by generating a PDF through the API: `POST /api/invoices/[id]/finalize`
4. Check the output PDF visually — CSS rendering in Puppeteer can differ from browsers
5. Run existing tests: `npm test`

## When Creating New Templates

1. Create `src/lib/pdf/templates/<name>.ts`
2. Export a `render<Name>(data: <Name>Data): string` function and a `<Name>Data` interface
3. Add the rendering step in `generate.ts` following the existing pattern
4. Add the new page to the pdf-lib merge sequence in `generate.ts`
