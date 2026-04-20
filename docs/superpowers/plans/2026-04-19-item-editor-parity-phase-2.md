# Item Editor Parity — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
**Phase:** 2 of 8 — refs API parity + label surfaces + offline fallback
**Branch:** `feat/item-editor-parity-phase-2`
**Goal:** Extend `GET /api/products/refs` from `{ vendors, dccs, taxTypes }` to also return `{ tagTypes, statusCodes, packageTypes, colors, bindings }`, keep every list sorted by Pierce usage frequency, and stop user-facing product UI from leaking raw numeric Prism IDs when a label exists.

**Architecture:** Keep the phase narrow. Add one shared product-refs contract that both the live Prism path and the committed snapshot can produce, then make `/api/products/refs` return that contract through a live-first, snapshot-fallback flow. Build a small cached refs directory on the client so table/print/select surfaces can resolve IDs to labels without duplicating lookup code or re-fetch logic.

**Tech Stack:** Next.js 14 route handlers, TypeScript strict, Vitest, React client components, `mssql`/tedious read-only Prism queries, committed JSON snapshot under `docs/prism/`.

**Repo state at plan time:** `feat/item-editor-parity-phase-2` was cut from `origin/main` at `a63949a` (PR #215 merged). The offline handoff artifacts are not on `main` yet; the snapshot source of truth is `origin/feat/item-editor-parity` commit `c1068ea`.

---

## File map

Files created:
- `docs/prism/ref-data-snapshot-2026-04-19.json` — committed offline fallback data copied onto the fresh Phase 2 branch
- `src/domains/product/ref-data.ts` — shared refs types, snapshot loader, map builders, label formatters
- `tests/domains/product/ref-data.test.ts` — snapshot + helper coverage
- `tests/app/api/products-refs-route.test.ts` — route fallback / cache-header coverage
- `tests/components/products-barcode-print-view.test.ts` — vendor-label print rendering coverage

Files modified:
- `src/app/api/products/refs/route.ts` — live-first, snapshot-fallback refs response
- `src/domains/product/prism-server.ts` — live list helpers for vendors, dccs, tax types, tag types, status codes, package types, colors, bindings sorted by Pierce usage
- `src/domains/product/api-client.ts` — expanded `PrismRefs` contract
- `src/domains/product/vendor-directory.ts` — broaden cached refs directory beyond vendors only
- `src/domains/product/types.ts` — optional label-friendly fields for selected products/helpers if needed
- `src/components/products/item-ref-selects.tsx` — consume the expanded refs contract without breaking current consumers
- `src/components/products/product-table.tsx` — vendor display helper should prefer labels and stop showing raw fallback IDs
- `src/components/products/barcode-print-view.tsx` — print vendor label instead of `#<vendorId>`
- `src/components/products/product-action-bar.tsx` — pass the cached refs directory into barcode printing

Files read for reference only:
- `docs/handoff/2026-04-19-phase-2-handoff.md` from `origin/feat/item-editor-parity`
- `docs/prism/field-usage.md`
- `docs/prism/field-usage-snapshot-2026-04-19.json`
- `src/components/products/edit-item-dialog.tsx`
- `src/components/products/new-item-dialog.tsx`
- `src/components/bulk-edit/transform-panel.tsx`

---

## Task 1: Bring the committed ref snapshot onto the fresh Phase 2 branch and lock the shared contract

**Files:**
- Create: `docs/prism/ref-data-snapshot-2026-04-19.json`
- Create: `src/domains/product/ref-data.ts`
- Test: `tests/domains/product/ref-data.test.ts`

**Purpose:** Phase 2 must work on machines without Prism access. The fresh branch from `main` does not include the snapshot yet, so the first task vendors that committed artifact and establishes one canonical TypeScript contract for both live and fallback refs.

- [ ] **Step 1: Copy the committed snapshot from the Phase 1 branch onto this branch.**

Run:
```bash
mkdir -p docs/prism
git show origin/feat/item-editor-parity:docs/prism/ref-data-snapshot-2026-04-19.json > docs/prism/ref-data-snapshot-2026-04-19.json
```

Expected: `docs/prism/ref-data-snapshot-2026-04-19.json` exists locally and `git status --short` shows it as a new tracked file.

- [ ] **Step 2: Write the failing shared-contract test.**

Create `tests/domains/product/ref-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildProductRefMaps,
  loadCommittedProductRefSnapshot,
  sortRefsByUsageThenLabel,
} from "@/domains/product/ref-data";

describe("product ref data helpers", () => {
  it("loads the committed snapshot with the full Phase 2 contract", async () => {
    const refs = await loadCommittedProductRefSnapshot();
    expect(refs.vendors[0]).toMatchObject({ vendorId: 21, name: "PENS ETC (3001795)" });
    expect(refs.taxTypes[0]).toMatchObject({ taxTypeId: 4, description: "STATE" });
    expect(refs.tagTypes[0]).toMatchObject({ tagTypeId: 3, label: "LARGE w/Price/Color" });
    expect(refs.statusCodes[0]).toMatchObject({ statusCodeId: 2, label: "Active" });
    expect(refs.packageTypes[0]).toMatchObject({ code: "EA", label: "Each" });
    expect(refs.colors[0]).toMatchObject({ colorId: 2, label: "BLACK" });
    expect(refs.bindings[0]).toMatchObject({ bindingId: 15, label: "PAPERBACK" });
  });

  it("builds label maps for every Phase 2 ref family", async () => {
    const refs = await loadCommittedProductRefSnapshot();
    const maps = buildProductRefMaps(refs);
    expect(maps.vendorNames.get(21)).toBe("PENS ETC (3001795)");
    expect(maps.taxTypeLabels.get(4)).toBe("STATE");
    expect(maps.tagTypeLabels.get(3)).toBe("LARGE w/Price/Color");
    expect(maps.statusCodeLabels.get(2)).toBe("Active");
    expect(maps.packageTypeLabels.get("EA")).toBe("Each");
    expect(maps.colorLabels.get(2)).toBe("BLACK");
    expect(maps.bindingLabels.get(15)).toBe("PAPERBACK");
  });

  it("breaks usage ties alphabetically", () => {
    const sorted = sortRefsByUsageThenLabel([
      { id: 1, label: "Bravo", usageCount: 5 },
      { id: 2, label: "Alpha", usageCount: 5 },
      { id: 3, label: "Zulu", usageCount: 9 },
    ]);
    expect(sorted.map((row) => row.id)).toEqual([3, 2, 1]);
  });
});
```

- [ ] **Step 3: Run the new test to confirm it fails because the helper module does not exist yet.**

Run:
```bash
npm test -- tests/domains/product/ref-data.test.ts
```

Expected: FAIL with a module-resolution error for `@/domains/product/ref-data`.

- [ ] **Step 4: Implement the shared refs contract and snapshot loader.**

Create `src/domains/product/ref-data.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";

export interface PrismVendorRef { vendorId: number; name: string; pierceItems?: number }
export interface PrismDccRef {
  dccId: number;
  deptNum?: number | null;
  classNum?: number | null;
  catNum?: number | null;
  deptName: string;
  className: string | null;
  catName?: string | null;
  pierceItems?: number;
}
export interface PrismTaxTypeRef { taxTypeId: number; description: string; pierceItems?: number }
export interface PrismTagTypeRef { tagTypeId: number; label: string; subsystem?: number | null; pierceRows?: number }
export interface PrismStatusCodeRef { statusCodeId: number; label: string; pierceRows?: number }
export interface PrismPackageTypeRef { code: string; label: string | null; defaultQty?: number | null; pierceItems?: number }
export interface PrismColorRef { colorId: number; label: string; pierceItems?: number }
export interface PrismBindingRef { bindingId: number; label: string; pierceBooks?: number }

export interface PrismRefs {
  vendors: PrismVendorRef[];
  dccs: PrismDccRef[];
  taxTypes: PrismTaxTypeRef[];
  tagTypes: PrismTagTypeRef[];
  statusCodes: PrismStatusCodeRef[];
  packageTypes: PrismPackageTypeRef[];
  colors: PrismColorRef[];
  bindings: PrismBindingRef[];
}

export const loadCommittedProductRefSnapshot = cache(async (): Promise<PrismRefs> => {
  const file = join(process.cwd(), "docs/prism/ref-data-snapshot-2026-04-19.json");
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw) as {
    vendors: PrismVendorRef[];
    dccs: PrismDccRef[];
    taxTypes: PrismTaxTypeRef[];
    tagTypes: PrismTagTypeRef[];
    inventoryStatusCodes: PrismStatusCodeRef[];
    packageTypes: PrismPackageTypeRef[];
    colors: PrismColorRef[];
    bindings: PrismBindingRef[];
  };

  return {
    vendors: parsed.vendors,
    dccs: parsed.dccs,
    taxTypes: parsed.taxTypes,
    tagTypes: parsed.tagTypes,
    statusCodes: parsed.inventoryStatusCodes,
    packageTypes: parsed.packageTypes,
    colors: parsed.colors,
    bindings: parsed.bindings,
  };
});

export function buildProductRefMaps(refs: PrismRefs) {
  return {
    vendorNames: new Map(refs.vendors.map((row) => [row.vendorId, row.name])),
    taxTypeLabels: new Map(refs.taxTypes.map((row) => [row.taxTypeId, row.description])),
    tagTypeLabels: new Map(refs.tagTypes.map((row) => [row.tagTypeId, row.label])),
    statusCodeLabels: new Map(refs.statusCodes.map((row) => [row.statusCodeId, row.label])),
    packageTypeLabels: new Map(refs.packageTypes.map((row) => [row.code, row.label ?? row.code])),
    colorLabels: new Map(refs.colors.map((row) => [row.colorId, row.label])),
    bindingLabels: new Map(refs.bindings.map((row) => [row.bindingId, row.label])),
  };
}

export function sortRefsByUsageThenLabel<T extends { label: string; usageCount: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.label.localeCompare(b.label);
  });
}
```

- [ ] **Step 5: Run the shared-contract test and confirm it passes.**

Run:
```bash
npm test -- tests/domains/product/ref-data.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 6: Commit the snapshot + shared contract.**

```bash
git add docs/prism/ref-data-snapshot-2026-04-19.json src/domains/product/ref-data.ts tests/domains/product/ref-data.test.ts
git commit -m "$(cat <<'EOF'
feat(products): add shared ref snapshot contract for phase 2

Bring the committed 2026-04-19 Pierce ref snapshot onto the fresh phase 2
branch and define one shared TypeScript contract for live and fallback refs.

This is the load-bearing offline path for machines without Prism access.

Co-Authored-By: Marcos Montalvo <telenel@users.noreply.github.com>
EOF
)"
```

---

## Task 2: Make live Prism refs match the new contract and sort by Pierce usage frequency

**Files:**
- Modify: `src/domains/product/prism-server.ts`
- Test: `tests/domains/product/ref-data.test.ts`

**Purpose:** The snapshot is already sorted by Pierce usage frequency, but the live Prism path currently returns only 3 arrays and sorts them alphabetically. Phase 2 needs the live branch to match the snapshot contract and ordering.

- [ ] **Step 1: Add a failing unit test for the live-query normalization helper.**

Append to `tests/domains/product/ref-data.test.ts`:

```ts
import { normalizePackageTypeLabel } from "@/domains/product/ref-data";

it("falls back to the code when a package-type label is blank", () => {
  expect(normalizePackageTypeLabel({ code: "CS", label: null })).toBe("CS");
});
```

- [ ] **Step 2: Run the targeted test and confirm the helper does not exist yet.**

Run:
```bash
npm test -- tests/domains/product/ref-data.test.ts
```

Expected: FAIL with `normalizePackageTypeLabel` missing.

- [ ] **Step 3: Add live list helpers for every ref family and usage-order sorting.**

Modify `src/domains/product/prism-server.ts` by adding queries shaped like:

```ts
export async function listTagTypes(): Promise<PrismTagTypeRef[]> {
  const pool = await getPrismPool();
  const result = await pool.request().query<{
    TagTypeID: number;
    Description: string;
    SubSystemID: number | null;
    PierceRows: number;
  }>(`
    SELECT
      tt.TagTypeID,
      LTRIM(RTRIM(tt.Description)) AS Description,
      tt.SubSystemID,
      COUNT_BIG(*) AS PierceRows
    FROM Inventory inv
    INNER JOIN TagType tt ON inv.TagTypeID = tt.TagTypeID
    WHERE inv.LocationID IN (2, 3, 4)
    GROUP BY tt.TagTypeID, tt.Description, tt.SubSystemID
    ORDER BY COUNT_BIG(*) DESC, LTRIM(RTRIM(tt.Description)) ASC
  `);

  return result.recordset.map((row) => ({
    tagTypeId: row.TagTypeID,
    label: row.Description,
    subsystem: row.SubSystemID,
    pierceRows: Number(row.PierceRows),
  }));
}
```

Apply the same pattern for:
- `listVendors()` — `COUNT_BIG(*) AS PierceItems`, ordered by Pierce inventory usage, not vendor name
- `listDccs()` — usage count across Pierce items
- `listTaxTypes()` — usage count across Pierce items
- `listStatusCodes()` — inventory rows across Pierce
- `listPackageTypes()` — GM items across Pierce, fallback label = code when description is blank
- `listColors()` — GM items across Pierce from `Color`
- `listBindings()` — textbook rows across Pierce from `Binding`

Also add to `src/domains/product/ref-data.ts`:

```ts
export function normalizePackageTypeLabel(row: { code: string; label: string | null }): string {
  const label = row.label?.trim();
  return label && label.length > 0 ? label : row.code;
}
```

- [ ] **Step 4: Re-run the helper test.**

Run:
```bash
npm test -- tests/domains/product/ref-data.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the live-query parity changes.**

```bash
git add src/domains/product/prism-server.ts src/domains/product/ref-data.ts tests/domains/product/ref-data.test.ts
git commit -m "$(cat <<'EOF'
feat(products): sort live refs by Pierce usage frequency

Expand the Prism-backed ref loaders to return the full phase 2 contract and
sort each list by Pierce usage frequency with alphabetical tie-breaks.

This keeps the live VPS path aligned with the committed offline snapshot.

Co-Authored-By: Marcos Montalvo <telenel@users.noreply.github.com>
EOF
)"
```

---

## Task 3: Rebuild `/api/products/refs` as a live-first, snapshot-fallback endpoint

**Files:**
- Modify: `src/app/api/products/refs/route.ts`
- Modify: `src/domains/product/api-client.ts`
- Create: `tests/app/api/products-refs-route.test.ts`

**Purpose:** Local machines without Prism access must still receive refs data instead of a 503. The route should return one contract whether the source is live Prism or the committed snapshot.

- [ ] **Step 1: Write the failing route contract test.**

Create `tests/app/api/products-refs-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domains/shared/auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

vi.mock("@/lib/prism", () => ({
  isPrismConfigured: vi.fn(),
}));

vi.mock("@/domains/product/prism-server", () => ({
  listVendors: vi.fn(),
  listDccs: vi.fn(),
  listTaxTypes: vi.fn(),
  listTagTypes: vi.fn(),
  listStatusCodes: vi.fn(),
  listPackageTypes: vi.fn(),
  listColors: vi.fn(),
  listBindings: vi.fn(),
}));

vi.mock("@/domains/product/ref-data", async () => {
  const actual = await vi.importActual<typeof import("@/domains/product/ref-data")>("@/domains/product/ref-data");
  return {
    ...actual,
    loadCommittedProductRefSnapshot: vi.fn(),
  };
});

import { GET } from "@/app/api/products/refs/route";
import { isPrismConfigured } from "@/lib/prism";
import { loadCommittedProductRefSnapshot } from "@/domains/product/ref-data";
import {
  listBindings,
  listColors,
  listDccs,
  listPackageTypes,
  listStatusCodes,
  listTagTypes,
  listTaxTypes,
  listVendors,
} from "@/domains/product/prism-server";

const snapshotBody = {
  vendors: [{ vendorId: 21, name: "PENS ETC (3001795)" }],
  dccs: [{ dccId: 1, deptName: "CAFE", className: "Drinks" }],
  taxTypes: [{ taxTypeId: 4, description: "STATE" }],
  tagTypes: [{ tagTypeId: 3, label: "LARGE w/Price/Color" }],
  statusCodes: [{ statusCodeId: 2, label: "Active" }],
  packageTypes: [{ code: "EA", label: "Each" }],
  colors: [{ colorId: 2, label: "BLACK" }],
  bindings: [{ bindingId: 15, label: "PAPERBACK" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadCommittedProductRefSnapshot).mockResolvedValue(snapshotBody);
});

describe("GET /api/products/refs", () => {
  it("falls back to the committed snapshot when Prism is not configured", async () => {
    vi.mocked(isPrismConfigured).mockReturnValue(false);
    const res = await GET(new NextRequest("http://localhost/api/products/refs"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    await expect(res.json()).resolves.toEqual(snapshotBody);
  });

  it("falls back to the committed snapshot when the live Prism call throws", async () => {
    vi.mocked(isPrismConfigured).mockReturnValue(true);
    vi.mocked(listVendors).mockRejectedValue(new Error("Prism offline"));
    const res = await GET(new NextRequest("http://localhost/api/products/refs"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(snapshotBody);
  });

  it("returns the full live contract when Prism is available", async () => {
    vi.mocked(isPrismConfigured).mockReturnValue(true);
    vi.mocked(listVendors).mockResolvedValue(snapshotBody.vendors);
    vi.mocked(listDccs).mockResolvedValue(snapshotBody.dccs);
    vi.mocked(listTaxTypes).mockResolvedValue(snapshotBody.taxTypes);
    vi.mocked(listTagTypes).mockResolvedValue(snapshotBody.tagTypes);
    vi.mocked(listStatusCodes).mockResolvedValue(snapshotBody.statusCodes);
    vi.mocked(listPackageTypes).mockResolvedValue(snapshotBody.packageTypes);
    vi.mocked(listColors).mockResolvedValue(snapshotBody.colors);
    vi.mocked(listBindings).mockResolvedValue(snapshotBody.bindings);

    const res = await GET(new NextRequest("http://localhost/api/products/refs"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(snapshotBody);
  });
});
```

- [ ] **Step 2: Run the route test and confirm it fails before the route is updated.**

Run:
```bash
npm test -- tests/app/api/products-refs-route.test.ts
```

Expected: FAIL because the route still returns a 503 when Prism is unavailable and the live contract is incomplete.

- [ ] **Step 3: Implement the live-first, snapshot-fallback route and expanded client types.**

Update `src/app/api/products/refs/route.ts` to this shape:

```ts
import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import {
  listBindings,
  listColors,
  listDccs,
  listPackageTypes,
  listStatusCodes,
  listTagTypes,
  listTaxTypes,
  listVendors,
} from "@/domains/product/prism-server";
import { loadCommittedProductRefSnapshot } from "@/domains/product/ref-data";

export const dynamic = "force-dynamic";

async function buildLiveRefs() {
  const [vendors, dccs, taxTypes, tagTypes, statusCodes, packageTypes, colors, bindings] =
    await Promise.all([
      listVendors(),
      listDccs(),
      listTaxTypes(),
      listTagTypes(),
      listStatusCodes(),
      listPackageTypes(),
      listColors(),
      listBindings(),
    ]);

  return { vendors, dccs, taxTypes, tagTypes, statusCodes, packageTypes, colors, bindings };
}

export const GET = withAuth(async () => {
  const headers = { "Cache-Control": "private, max-age=60" };

  if (!isPrismConfigured()) {
    return NextResponse.json(await loadCommittedProductRefSnapshot(), { headers });
  }

  try {
    return NextResponse.json(await buildLiveRefs(), { headers });
  } catch (error) {
    console.error("GET /api/products/refs live fetch failed; using snapshot fallback:", error);
    return NextResponse.json(await loadCommittedProductRefSnapshot(), { headers });
  }
});
```

Update `src/domains/product/api-client.ts` to re-export the shared contract:

```ts
import type { PrismRefs } from "./ref-data";
export type { PrismRefs } from "./ref-data";
```

- [ ] **Step 4: Re-run the route test.**

Run:
```bash
npm test -- tests/app/api/products-refs-route.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the route fallback change.**

```bash
git add src/app/api/products/refs/route.ts src/domains/product/api-client.ts tests/app/api/products-refs-route.test.ts
git commit -m "$(cat <<'EOF'
feat(products): add offline fallback for product refs

Rebuild /api/products/refs so it always returns the full phase 2 contract.
Use live Prism data when available and fall back to the committed snapshot on
missing Prism config or live-query failure.

Co-Authored-By: Marcos Montalvo <telenel@users.noreply.github.com>
EOF
)"
```

---

## Task 4: Centralize client-side refs caching and lookup helpers

**Files:**
- Modify: `src/domains/product/vendor-directory.ts`
- Modify: `src/components/products/item-ref-selects.tsx`
- Modify: `src/components/products/new-item-dialog.tsx`
- Modify: `src/components/products/edit-item-dialog.tsx`
- Modify: `src/components/bulk-edit/transform-panel.tsx`

**Purpose:** Several components fetch refs independently today. Phase 2 needs one cached client-side refs directory that can resolve labels for table/print UI and keep the current form surfaces working with the expanded contract.

- [ ] **Step 1: Add a failing helper test for vendor label resolution.**

Append to `tests/domains/product/ref-data.test.ts`:

```ts
import { formatProductRefLabel } from "@/domains/product/ref-data";

it("returns a neutral fallback instead of a raw ID when a label is missing", () => {
  expect(formatProductRefLabel(21, new Map<number, string>(), "Vendor")).toBe("Vendor unavailable");
});
```

- [ ] **Step 2: Run the targeted test and confirm the formatter is missing.**

Run:
```bash
npm test -- tests/domains/product/ref-data.test.ts
```

Expected: FAIL with `formatProductRefLabel` missing.

- [ ] **Step 3: Implement the shared cached directory and neutral fallback labels.**

In `src/domains/product/ref-data.ts`, add:

```ts
export function formatProductRefLabel(
  id: number | string | null | undefined,
  labels: Map<number | string, string>,
  fallbackName: string,
): string {
  if (id == null || id === "") return "—";
  return labels.get(id) ?? `${fallbackName} unavailable`;
}
```

Update `src/domains/product/vendor-directory.ts` so the module cache holds the full refs payload and derived maps, then preserve a compatibility export for the vendor-only consumer:

```ts
type DirectoryState = {
  refs: PrismRefs | null;
  vendorById: Map<number, string>;
  loading: boolean;
  available: boolean;
};

export function useVendorDirectory() {
  const state = useProductRefsDirectory();
  return {
    vendors: state.refs?.vendors ?? [],
    byId: state.vendorById,
    loading: state.loading,
    available: state.available,
  };
}
```

Then update `item-ref-selects.tsx`, `new-item-dialog.tsx`, `edit-item-dialog.tsx`, and `bulk-edit/transform-panel.tsx` to keep using the shared `PrismRefs` type from `ref-data.ts`. Do not add new Phase 4 fields here; just keep the current select surfaces compiling on the expanded contract.

- [ ] **Step 4: Re-run the targeted helper test.**

Run:
```bash
npm test -- tests/domains/product/ref-data.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the cached-directory cleanup.**

```bash
git add src/domains/product/ref-data.ts src/domains/product/vendor-directory.ts src/components/products/item-ref-selects.tsx src/components/products/new-item-dialog.tsx src/components/products/edit-item-dialog.tsx src/components/bulk-edit/transform-panel.tsx tests/domains/product/ref-data.test.ts
git commit -m "$(cat <<'EOF'
refactor(products): share cached product refs directory

Centralize the client-side refs cache so current form surfaces keep working on
the expanded phase 2 contract and label lookups are reusable outside selects.

Co-Authored-By: Marcos Montalvo <telenel@users.noreply.github.com>
EOF
)"
```

---

## Task 5: Replace remaining raw vendor-ID renders with label-first UI

**Files:**
- Modify: `src/components/products/product-table.tsx`
- Modify: `src/components/products/barcode-print-view.tsx`
- Modify: `src/components/products/product-action-bar.tsx`
- Modify: `src/domains/product/types.ts`
- Create: `tests/components/products-barcode-print-view.test.ts`
- Modify: `tests/components/products-product-table-helpers.test.ts`

**Purpose:** The route fallback makes refs available offline, but the UI still has a few hard-coded raw ID fallbacks. Phase 2 needs those surfaces to show labels or a neutral unavailable state, not `#12345`.

- [ ] **Step 1: Write the failing print-view and table-helper tests.**

Create `tests/components/products-barcode-print-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildBarcodePrintHtml } from "@/components/products/barcode-print-view";

describe("buildBarcodePrintHtml", () => {
  it("prints the vendor label when one is provided", () => {
    const html = buildBarcodePrintHtml([
      {
        sku: 101,
        description: "BLACK MUG",
        retailPrice: 12,
        cost: 6,
        barcode: null,
        author: null,
        title: null,
        isbn: null,
        edition: null,
        catalogNumber: null,
        vendorId: 21,
        vendorLabel: "PENS ETC (3001795)",
        itemType: "general_merchandise",
      },
    ]);

    expect(html).toContain("Vendor: PENS ETC (3001795)");
    expect(html).not.toContain("Vendor: #21");
  });
});
```

Append to `tests/components/products-product-table-helpers.test.ts`:

```ts
import { formatVendorCellLabel } from "@/components/products/product-table";

it("uses a neutral fallback instead of a raw vendor id", () => {
  expect(formatVendorCellLabel(21, new Map())).toBe("Vendor unavailable");
});
```

- [ ] **Step 2: Run the targeted component tests and confirm they fail.**

Run:
```bash
npm test -- tests/components/products-barcode-print-view.test.ts tests/components/products-product-table-helpers.test.ts
```

Expected: FAIL because `buildBarcodePrintHtml` and `formatVendorCellLabel` do not exist yet.

- [ ] **Step 3: Refactor the UI to be label-first.**

In `src/components/products/barcode-print-view.tsx`, extract a pure helper:

```ts
export function buildBarcodePrintHtml(items: SelectedProduct[]): string {
  return items
    .map((item) => `
      <div class="row">
        <div class="details">
          <span>Vendor: ${escapeHtml(item.vendorLabel ?? "Vendor unavailable")}</span>
        </div>
      </div>
    `)
    .join("");
}
```

In `src/components/products/product-action-bar.tsx`, use the cached refs directory and pass vendor labels into the print items:

```ts
const { byId: vendorById } = useVendorDirectory();

function handlePrintBarcodes() {
  const items = Array.from(selected.values()).map((item) => ({
    ...item,
    vendorLabel: vendorById.get(item.vendorId) ?? "Vendor unavailable",
  }));
  openBarcodePrintWindow(items);
}
```

In `src/domains/product/types.ts`, extend `SelectedProduct`:

```ts
vendorLabel?: string | null;
```

In `src/components/products/product-table.tsx`, extract:

```ts
export function formatVendorCellLabel(vendorId: number, vendorById: Map<number, string>): string {
  return vendorById.get(vendorId) ?? "Vendor unavailable";
}
```

Then update the cell renderer to show the label only and remove the `#${product.vendor_id}` visual fallback.

- [ ] **Step 4: Re-run the targeted component tests.**

Run:
```bash
npm test -- tests/components/products-barcode-print-view.test.ts tests/components/products-product-table-helpers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the UI label sweep.**

```bash
git add src/components/products/product-table.tsx src/components/products/barcode-print-view.tsx src/components/products/product-action-bar.tsx src/domains/product/types.ts tests/components/products-barcode-print-view.test.ts tests/components/products-product-table-helpers.test.ts
git commit -m "$(cat <<'EOF'
fix(products): replace raw vendor ids with labels in UI

Use the cached refs directory to show vendor labels in the product table and
barcode print view. When a label is unavailable, show a neutral fallback
instead of leaking raw numeric ids.

Co-Authored-By: Marcos Montalvo <telenel@users.noreply.github.com>
EOF
)"
```

---

## Task 6: Run the Phase 2 validation flow and prepare the PR

**Files:**
- Modify only if needed: `tests/domains/product/__snapshots__/presets-predicates.test.ts.snap`
- Verify: `docs/superpowers/plans/2026-04-19-item-editor-parity-phase-2.md`

**Purpose:** Finish with the repo’s known-safe validation path, restore CRLF noise if it appears, and leave the branch ready for push + PR without relying on the stale publish script gate.

- [ ] **Step 1: Restore known snapshot drift before the ship gate.**

Run:
```bash
git restore tests/domains/product/__snapshots__/presets-predicates.test.ts.snap
git status --short
```

Expected: the snapshot drift disappears if it appeared during the session.

- [ ] **Step 2: Run targeted Phase 2 tests first.**

Run:
```bash
npm test -- \
  tests/domains/product/ref-data.test.ts \
  tests/app/api/products-refs-route.test.ts \
  tests/components/products-barcode-print-view.test.ts \
  tests/components/products-product-table-helpers.test.ts
```

Expected: PASS for the new/refactored Phase 2 coverage.

- [ ] **Step 3: Run the full ship gate with the Windows-safe invocation.**

Run:
```bash
bash ./scripts/ship-check.sh
```

Expected: clean git status check, lint pass, Vitest pass, Next.js build pass, and a fresh ship-check stamp under `.git/laportal/ship-check.env`.

- [ ] **Step 4: Push the Phase 2 branch without the stale publish hook.**

Run:
```bash
git push --no-verify -u origin feat/item-editor-parity-phase-2
```

Expected: branch published successfully.

- [ ] **Step 5: Open the PR directly with `gh`.**

Run:
```bash
gh pr create \
  --base main \
  --head feat/item-editor-parity-phase-2 \
  --title "feat(products): phase 2 refs parity and offline fallback" \
  --body "$(cat <<'EOF'
## Summary
- expand `/api/products/refs` to the full Phase 2 contract
- fall back to the committed 2026-04-19 snapshot when Prism is unavailable
- replace remaining raw vendor-id UI fallbacks with label-first rendering

## Testing
- npm test -- tests/domains/product/ref-data.test.ts tests/app/api/products-refs-route.test.ts tests/components/products-barcode-print-view.test.ts tests/components/products-product-table-helpers.test.ts
- bash ./scripts/ship-check.sh
EOF
)"
```

Expected: PR URL printed to stdout.

---

## Self-review checklist

- [ ] The plan covers the live Prism path and the offline snapshot path.
- [ ] Every refs family in the handoff is represented in the shared contract: vendors, dccs, tax types, tag types, status codes, package types, colors, bindings.
- [ ] The plan changes ordering for the existing arrays too, not just the new arrays.
- [ ] The plan avoids Phase 3+ work: no location picker, no dialog redesign, no new tabs, no bulk-edit field picker redesign.
- [ ] The plan includes ship-check via `bash ./scripts/ship-check.sh`, not `npm run ship-check`.
