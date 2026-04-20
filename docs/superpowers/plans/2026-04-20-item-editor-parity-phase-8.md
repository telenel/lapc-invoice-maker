# Item Editor Parity Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `/products/bulk-edit` pricing/catalog transform flow with the Phase 8 field-picker bulk editor that lets operators choose a small set of item or inventory fields, edit them with labels instead of raw IDs, and apply location-aware inventory updates through the existing v2 product patch path.

**Architecture:** Keep one bulk-edit workspace, but swap its request model from "compound pricing transform" to "selected fields + bulk values + optional inventory scope". Reuse the existing `ProductEditPatchV2` write contract and `/api/products/[sku]` semantics by introducing a bulk-edit field registry plus a pure mapper that turns chosen fields into per-row v2 patches and preview diffs. The UI becomes a searchable field-picker dialog/workspace with grouped fields, fill-rate hints from the committed Prism usage snapshot, and a result summary that mirrors the current commit/audit flow.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, existing product refs API/client, Supabase mirror reads, Prism-backed `/api/products/[sku]` v2 writes, Prisma audit log persistence.

---

## File Map

| Path | Responsibility |
|---|---|
| `docs/prism/field-usage.md` | Source of truth for Phase 8 field grouping/fill-rate hints |
| `src/domains/bulk-edit/types.ts` | New field-picker request/preview/result contracts |
| `src/domains/bulk-edit/field-registry.ts` | Field metadata, grouping, fill-rate labels, location requirements, ref option wiring |
| `src/domains/bulk-edit/patch-builder.ts` | Pure conversion from bulk values + source row into `ProductEditPatchV2` and preview cells |
| `src/domains/bulk-edit/preview-builder.ts` | Row preview assembly and aggregate warnings/totals for selected fields |
| `src/app/api/products/bulk-edit/dry-run/route.ts` | Validates selection + field values, loads source rows, returns Phase 8 preview |
| `src/app/api/products/bulk-edit/commit/route.ts` | Recomputes preview, materializes row-by-row v2 patches, applies them, records audit summary |
| `src/app/products/bulk-edit/page.tsx` | Workspace state for selected fields, field values, location target, preview, and result summary |
| `src/components/bulk-edit/selection-panel.tsx` | Selection UI remains; minor copy updates for field-picker flow |
| `src/components/bulk-edit/transform-panel.tsx` | Replaced by field-picker/value-entry surface |
| `src/components/bulk-edit/preview-panel.tsx` | Shows selected-field diffs instead of pricing-only table |
| `src/components/bulk-edit/field-picker.tsx` | Searchable grouped field checklist with fill-rate hints and 5-field practical cap |
| `src/components/bulk-edit/field-value-editor.tsx` | Renders the correct controls for the chosen fields and inventory location scope |
| `src/components/bulk-edit/commit-confirm-dialog.tsx` | Copy updates for field-based apply summary |
| `src/domains/product/api-client.ts` | Client types stay in sync with new bulk-edit request/response contracts |
| `tests/domains/bulk-edit/field-registry.test.ts` | Field ordering/grouping/fill-rate coverage |
| `tests/domains/bulk-edit/patch-builder.test.ts` | Pure mapper coverage for item/inventory/textbook/location-aware patches |
| `tests/domains/bulk-edit/preview-builder.test.ts` | Updated preview totals/warnings coverage for field diffs |
| `tests/app/api/products-bulk-edit-dry-run-route.test.ts` | Route coverage for validation, location targeting, and label-backed preview output |
| `tests/app/api/products-bulk-edit-commit-route.test.ts` | Commit coverage for v2 patch materialization and per-row result summary |
| `src/__tests__/products-bulk-edit-page.test.tsx` | UI flow coverage for field picker, location choice, preview, and commit |

### Task 1: Define the Phase 8 field registry and request types

**Files:**
- Create: `src/domains/bulk-edit/field-registry.ts`
- Modify: `src/domains/bulk-edit/types.ts`
- Test: `tests/domains/bulk-edit/field-registry.test.ts`

- [ ] **Step 1: Write the failing field-registry tests**

```ts
import { describe, expect, it } from "vitest";
import { BULK_EDIT_FIELDS, getBulkEditFieldById } from "@/domains/bulk-edit/field-registry";

describe("bulk-edit field registry", () => {
  it("keeps phase-8 fields grouped in spec order with fill-rate hints", () => {
    expect(BULK_EDIT_FIELDS.slice(0, 4).map((field) => field.id)).toEqual([
      "description",
      "dccId",
      "vendorId",
      "retail",
    ]);
    expect(getBulkEditFieldById("tagTypeId")?.group).toBe("inventory");
    expect(getBulkEditFieldById("tagTypeId")?.fillRateLabel).toMatch("100.0%");
  });

  it("marks inventory fields as requiring a location target", () => {
    expect(getBulkEditFieldById("cost")?.requiresInventoryLocation).toBe(true);
    expect(getBulkEditFieldById("bindingId")?.requiresInventoryLocation).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new test file and verify it fails**

Run: `npm test -- tests/domains/bulk-edit/field-registry.test.ts`

Expected: FAIL because `field-registry.ts` does not exist yet.

- [ ] **Step 3: Add the field registry and new type contracts**

```ts
export type BulkEditFieldGroup = "primary" | "inventory" | "more" | "advanced";

export interface BulkEditFieldDefinition {
  id: BulkEditFieldId;
  label: string;
  group: BulkEditFieldGroup;
  fillRateLabel: string;
  requiresInventoryLocation: boolean;
  refOptions?: "vendors" | "dccs" | "taxTypes" | "tagTypes" | "statusCodes" | "packageTypes" | "colors" | "bindings";
}

export const BULK_EDIT_FIELDS: BulkEditFieldDefinition[] = [
  { id: "description", label: "Description", group: "primary", fillRateLabel: "100.0%", requiresInventoryLocation: false },
  { id: "dccId", label: "DCC", group: "primary", fillRateLabel: "100.0%", requiresInventoryLocation: false, refOptions: "dccs" },
  { id: "vendorId", label: "Vendor", group: "primary", fillRateLabel: "100.0%", requiresInventoryLocation: false, refOptions: "vendors" },
  { id: "retail", label: "Retail", group: "inventory", fillRateLabel: "98.4%", requiresInventoryLocation: true },
];
```

- [ ] **Step 4: Update `types.ts` to carry selected fields, values, and preview cells**

```ts
export type BulkEditFieldId =
  | "description"
  | "vendorId"
  | "dccId"
  | "barcode"
  | "itemTaxTypeId"
  | "catalogNumber"
  | "packageType"
  | "unitsPerPack"
  | "title"
  | "author"
  | "isbn"
  | "edition"
  | "bindingId"
  | "retail"
  | "cost"
  | "expectedCost"
  | "tagTypeId"
  | "statusCodeId"
  | "estSales"
  | "fInvListPriceFlag"
  | "fTxWantListFlag"
  | "fTxBuybackListFlag"
  | "fNoReturns"
  | "fDiscontinue";

export interface BulkEditTransform {
  fieldIds: BulkEditFieldId[];
  inventoryScope: "primary" | "all" | 2 | 3 | 4 | null;
  values: Partial<Record<BulkEditFieldId, string | number | boolean | null>>;
}
```

- [ ] **Step 5: Re-run the focused registry tests**

Run: `npm test -- tests/domains/bulk-edit/field-registry.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the registry/types slice**

```bash
git add src/domains/bulk-edit/types.ts src/domains/bulk-edit/field-registry.ts tests/domains/bulk-edit/field-registry.test.ts
git commit -m "feat(bulk-edit): define phase 8 field registry"
```

### Task 2: Build the pure Phase 8 bulk patch mapper and preview model

**Files:**
- Create: `src/domains/bulk-edit/patch-builder.ts`
- Modify: `src/domains/bulk-edit/preview-builder.ts`
- Test: `tests/domains/bulk-edit/patch-builder.test.ts`
- Test: `tests/domains/bulk-edit/preview-builder.test.ts`

- [ ] **Step 1: Write failing pure tests for item, textbook, and location-aware inventory patches**

```ts
import { describe, expect, it } from "vitest";
import { buildBulkPatchForRow } from "@/domains/bulk-edit/patch-builder";

it("maps inventory fields to a single target location", () => {
  const result = buildBulkPatchForRow(
    sourceRow({ sku: 101, retail: 9.99, inventoryByLocation: [{ locationId: 2, retail: 9.99, cost: 4.5 }] }),
    { fieldIds: ["retail", "tagTypeId"], inventoryScope: 3, values: { retail: 12.5, tagTypeId: 7 } },
  );

  expect(result.patch.inventory).toEqual([{ locationId: 3, retail: 12.5, tagTypeId: 7 }]);
  expect(result.changedFields).toEqual(["retail", "tagTypeId"]);
});

it("maps textbook fields onto the v2 textbook bucket", () => {
  const result = buildBulkPatchForRow(
    sourceRow({ itemType: "textbook", title: "Old" }),
    { fieldIds: ["title", "bindingId"], inventoryScope: null, values: { title: "New", bindingId: 4 } },
  );

  expect(result.patch.textbook).toMatchObject({ title: "New", bindingId: 4 });
});
```

- [ ] **Step 2: Run the pure tests and confirm they fail**

Run: `npm test -- tests/domains/bulk-edit/patch-builder.test.ts tests/domains/bulk-edit/preview-builder.test.ts`

Expected: FAIL because `patch-builder.ts` and the new preview shape do not exist yet.

- [ ] **Step 3: Implement the pure patch builder**

```ts
export function buildBulkPatchForRow(
  row: BulkEditSourceRow,
  transform: BulkEditTransform,
): { patch: ProductEditPatchV2; changedFields: BulkEditFieldId[] } {
  const item: ProductEditPatchV2["item"] = {};
  const gm: ProductEditPatchV2["gm"] = {};
  const textbook: ProductEditPatchV2["textbook"] = {};
  const inventory = buildInventoryEntries(row, transform);

  for (const fieldId of transform.fieldIds) {
    const value = transform.values[fieldId];
    applyFieldValue({ row, fieldId, value, item, gm, textbook, inventory });
  }

  return {
    patch: {
      item: hasPatchFields(item) ? item : undefined,
      gm: hasPatchFields(gm) ? gm : undefined,
      textbook: hasPatchFields(textbook) ? textbook : undefined,
      inventory: inventory.length > 0 ? inventory : undefined,
    },
    changedFields,
  };
}
```

- [ ] **Step 4: Update preview rows to show per-field before/after cells**

```ts
export interface PreviewCell {
  fieldId: BulkEditFieldId;
  label: string;
  beforeLabel: string;
  afterLabel: string;
}

export interface PreviewRow {
  sku: number;
  description: string;
  changedFields: BulkEditFieldId[];
  cells: PreviewCell[];
  warnings: PreviewWarning[];
}
```

- [ ] **Step 5: Re-run the pure bulk-edit test suite**

Run: `npm test -- tests/domains/bulk-edit/patch-builder.test.ts tests/domains/bulk-edit/preview-builder.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the pure mapper/preview slice**

```bash
git add src/domains/bulk-edit/patch-builder.ts src/domains/bulk-edit/preview-builder.ts tests/domains/bulk-edit/patch-builder.test.ts tests/domains/bulk-edit/preview-builder.test.ts
git commit -m "feat(bulk-edit): build phase 8 bulk patch mapper"
```

### Task 3: Upgrade the dry-run and commit routes to use the v2 bulk mapper

**Files:**
- Modify: `src/app/api/products/bulk-edit/dry-run/route.ts`
- Modify: `src/app/api/products/bulk-edit/commit/route.ts`
- Modify: `src/domains/product/api-client.ts`
- Test: `tests/app/api/products-bulk-edit-dry-run-route.test.ts`
- Test: `tests/app/api/products-bulk-edit-commit-route.test.ts`

- [ ] **Step 1: Write failing route tests for location targeting, field validation, and v2 patch materialization**

```ts
it("rejects inventory fields without an inventory scope", async () => {
  const response = await POST_DRY_RUN(jsonRequest({
    selection: { skus: [101], scope: "pierce" },
    transform: { fieldIds: ["retail"], inventoryScope: null, values: { retail: 10 } },
  }));

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    errors: [expect.objectContaining({ code: "MISSING_INVENTORY_SCOPE" })],
  });
});

it("commits row patches through the v2 product PATCH path", async () => {
  await POST_COMMIT(jsonRequest({
    selection: { skus: [101], scope: "pierce" },
    transform: { fieldIds: ["retail", "tagTypeId"], inventoryScope: 2, values: { retail: 12.5, tagTypeId: 7 } },
  }));

  expect(updateProductMock).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({
    mode: "v2",
    patch: expect.objectContaining({
      inventory: [{ locationId: 2, retail: 12.5, tagTypeId: 7 }],
    }),
  }));
});
```

- [ ] **Step 2: Run the route tests and verify they fail**

Run: `npm test -- tests/app/api/products-bulk-edit-dry-run-route.test.ts tests/app/api/products-bulk-edit-commit-route.test.ts`

Expected: FAIL because the routes still accept the old pricing/catalog transform shape.

- [ ] **Step 3: Replace route validation and source-row mapping**

```ts
const bodySchema = z.object({
  selection: selectionSchema,
  transform: bulkEditTransformSchema,
});

const preview = buildPreview(sourceRows, transform, refs);
if (preview.errors.length > 0) {
  return NextResponse.json({ errors: preview.errors }, { status: 400 });
}
```

- [ ] **Step 4: Materialize row-by-row v2 writes in commit**

```ts
for (const row of preview.rows.filter((entry) => entry.changedFields.length > 0)) {
  const sourceRow = sourceRowsBySku.get(row.sku)!;
  const built = buildBulkPatchForRow(sourceRow, transform);
  await updateProductV2(row.sku, built.patch);
}
```

- [ ] **Step 5: Re-run the focused route tests**

Run: `npm test -- tests/app/api/products-bulk-edit-dry-run-route.test.ts tests/app/api/products-bulk-edit-commit-route.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the route slice**

```bash
git add src/app/api/products/bulk-edit/dry-run/route.ts src/app/api/products/bulk-edit/commit/route.ts src/domains/product/api-client.ts tests/app/api/products-bulk-edit-dry-run-route.test.ts tests/app/api/products-bulk-edit-commit-route.test.ts
git commit -m "feat(bulk-edit): route phase 8 field picker writes through v2 patches"
```

### Task 4: Replace the workspace transform UI with the Phase 8 field picker

**Files:**
- Create: `src/components/bulk-edit/field-picker.tsx`
- Create: `src/components/bulk-edit/field-value-editor.tsx`
- Modify: `src/components/bulk-edit/transform-panel.tsx`
- Modify: `src/components/bulk-edit/selection-panel.tsx`
- Modify: `src/app/products/bulk-edit/page.tsx`
- Test: `src/__tests__/products-bulk-edit-page.test.tsx`

- [ ] **Step 1: Write failing UI tests for selecting fields, capping the checklist, and revealing the correct inputs**

```tsx
it("lets the operator search for a field and adds only the chosen editors", async () => {
  render(<BulkEditPage />);

  await user.type(screen.getByRole("searchbox", { name: /which fields/i }), "tag");
  await user.click(screen.getByRole("checkbox", { name: /tag type/i }));

  expect(screen.getByLabelText(/tag type/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/vendor/i)).not.toBeInTheDocument();
});

it("requires a location selector when any inventory field is chosen", async () => {
  render(<BulkEditPage />);
  await pickField("Retail");
  expect(screen.getByRole("combobox", { name: /which location/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the page test and verify it fails**

Run: `npm test -- src/__tests__/products-bulk-edit-page.test.tsx`

Expected: FAIL because the page still renders the old pricing/catalog transform form.

- [ ] **Step 3: Add the field picker and editor components**

```tsx
<FieldPicker
  searchValue={fieldSearch}
  selectedFieldIds={transform.fieldIds}
  onToggleField={toggleField}
  maxFields={5}
/>

<FieldValueEditor
  refs={refs}
  transform={transform}
  onChange={setTransform}
/>
```

- [ ] **Step 4: Update workspace page state and CTA copy**

```tsx
const EMPTY_TRANSFORM: BulkEditTransform = {
  fieldIds: [],
  inventoryScope: null,
  values: {},
};

<Button onClick={runPreview} disabled={transform.fieldIds.length === 0 || previewing}>
  {previewing ? "Building preview..." : `Preview ${selectionLabel}`}
</Button>
```

- [ ] **Step 5: Re-run the page UI test**

Run: `npm test -- src/__tests__/products-bulk-edit-page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the UI replacement slice**

```bash
git add src/components/bulk-edit/field-picker.tsx src/components/bulk-edit/field-value-editor.tsx src/components/bulk-edit/transform-panel.tsx src/components/bulk-edit/selection-panel.tsx src/app/products/bulk-edit/page.tsx src/__tests__/products-bulk-edit-page.test.tsx
git commit -m "feat(bulk-edit): replace transform form with phase 8 field picker"
```

### Task 5: Finish the preview/result UX and inventory label plumbing

**Files:**
- Modify: `src/components/bulk-edit/preview-panel.tsx`
- Modify: `src/components/bulk-edit/commit-confirm-dialog.tsx`
- Modify: `src/domains/bulk-edit/preview-builder.ts`
- Modify: `src/domains/product/ref-data.ts`
- Test: `src/__tests__/products-bulk-edit-page.test.tsx`
- Test: `tests/domains/bulk-edit/preview-builder.test.ts`

- [ ] **Step 1: Write failing tests for label-backed preview rows and success summary**

```ts
it("renders labels instead of raw IDs for reference-backed fields", () => {
  const preview = buildPreview([row()], transform, refs);
  expect(preview.rows[0].cells).toContainEqual(
    expect.objectContaining({ fieldId: "tagTypeId", afterLabel: "CLEARANCE" }),
  );
});

it("shows a field-oriented commit summary after apply", async () => {
  render(<BulkEditPage />);
  await commitPreview();
  expect(screen.getByText(/applied tag type, retail to 3 items/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the preview-focused tests and verify they fail**

Run: `npm test -- tests/domains/bulk-edit/preview-builder.test.ts src/__tests__/products-bulk-edit-page.test.tsx`

Expected: FAIL because preview rows still show the pricing-only columns.

- [ ] **Step 3: Render field-based diff cells in the preview panel**

```tsx
{preview.rows.map((row) => (
  <tr key={row.sku}>
    <td>{row.sku}</td>
    <td>{row.description}</td>
    <td>
      {row.cells.map((cell) => (
        <div key={cell.fieldId}>
          <span>{cell.label}</span>
          <span>{cell.beforeLabel}</span>
          <span>{cell.afterLabel}</span>
        </div>
      ))}
    </td>
  </tr>
))}
```

- [ ] **Step 4: Update the commit dialog and toast copy to summarize selected fields**

```ts
const changedFieldSummary = preview.changedFieldLabels.join(", ");
setToast(`Applied ${changedFieldSummary} to ${result.successCount} item${result.successCount === 1 ? "" : "s"}.`);
```

- [ ] **Step 5: Re-run the preview/result tests**

Run: `npm test -- tests/domains/bulk-edit/preview-builder.test.ts src/__tests__/products-bulk-edit-page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the preview/result slice**

```bash
git add src/components/bulk-edit/preview-panel.tsx src/components/bulk-edit/commit-confirm-dialog.tsx src/domains/bulk-edit/preview-builder.ts src/domains/product/ref-data.ts src/__tests__/products-bulk-edit-page.test.tsx tests/domains/bulk-edit/preview-builder.test.ts
git commit -m "feat(bulk-edit): ship phase 8 preview and commit summary"
```

### Task 6: Run the full Phase 8 regression set and ship

**Files:**
- Verify only: bulk-edit source/tests plus any touched product editor files

- [ ] **Step 1: Run the focused Phase 8 regression suite**

Run:

```bash
npm test -- \
  tests/domains/bulk-edit/field-registry.test.ts \
  tests/domains/bulk-edit/patch-builder.test.ts \
  tests/domains/bulk-edit/preview-builder.test.ts \
  tests/app/api/products-bulk-edit-dry-run-route.test.ts \
  tests/app/api/products-bulk-edit-commit-route.test.ts \
  src/__tests__/products-bulk-edit-page.test.tsx \
  tests/app/api/product-patch-route-v2.test.ts \
  src/components/products/edit-item-dialog-v2.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run hygiene checks**

Run:

```bash
git diff --check
npx prisma generate
```

Expected: both pass with no errors.

- [ ] **Step 3: Run repo ship-check**

Run: `bash ./scripts/ship-check.sh`

Expected: lint, Vitest, and production build all pass on the Phase 8 branch.

- [ ] **Step 4: Push and open the PR**

Run:

```bash
git push --set-upstream origin feat/item-editor-parity-phase-8
gh pr create --base main --head feat/item-editor-parity-phase-8 --title "feat(products): ship item editor parity phase 8" --body-file .github/pull_request_template.md
```

Expected: branch pushed and PR opened.

- [ ] **Step 5: Enable auto-merge after green CI**

Run:

```bash
gh pr merge --auto --squash --delete-branch=false
```

Expected: auto-merge enabled.

- [ ] **Step 6: Verify production after merge**

Run:

```bash
gh pr view --json state,mergedAt,url
curl -fsS https://laportal.montalvo.io/api/version
```

Expected: PR shows `MERGED`; production `/api/version` responds and the deployed SHA matches the merged Phase 8 commit.

---

## Self-Review Checklist

- [ ] Phase 8 stays scoped to the bulk-edit field-picker redesign only; no Phase 9+ work is introduced.
- [ ] Inventory fields always require an explicit location scope (`primary`, a single location, or `all`).
- [ ] Bulk writes route through the existing v2 product write semantics instead of inventing a second write path.
- [ ] Preview and result UI never leak raw numeric IDs when a label exists in refs.
- [ ] The plan keeps TDD and one focused commit per task.
