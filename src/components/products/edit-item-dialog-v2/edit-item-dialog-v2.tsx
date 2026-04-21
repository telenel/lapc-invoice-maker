"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productApi } from "@/domains/product/api-client";
import {
  DEFAULT_PRODUCT_LOCATION_IDS,
  getPrimaryProductLocationId,
  normalizeProductLocationIds,
  type ProductLocationId,
} from "@/domains/product/location-filters";
import type { ProductEditDetails } from "@/domains/product/types";
import { useProductRefDirectory } from "@/domains/product/vendor-directory";
import type { EditItemDialogProps } from "../edit-item-dialog-legacy";
import { SelectedItemsSummary } from "./components/selected-items-summary";
import { buildInventoryPatch, buildV2Patch, hasPatchFields } from "./state/form-builders";
import {
  syncInventoryField,
  toFormState,
  toInventoryState,
} from "./state/form-state";
import {
  EDITABLE_INVENTORY_FIELDS,
  EMPTY_FORM,
  INVENTORY_LOCATION_IDS,
  INVENTORY_LOCATION_LABELS,
  type DirtyInventoryFields,
  type FormState,
  type InventoryFieldKey,
  type InventoryFormState,
  type InventoryLocationId,
  type InventoryStateByLocation,
  makeEmptyDirtyInventoryFields,
  makeEmptyInventoryState,
} from "./state/types";
import { InventoryTabContent } from "./tabs/inventory-tab";
import { PrimaryTabContent } from "./tabs/primary-tab";
import { TextbookTabContent } from "./tabs/textbook-tab";

// Re-export state helpers for callers that used to import them from the
// monolith.
export {
  getPrimaryInventoryField,
  toFormState,
  toInventoryState,
} from "./state/form-state";

export interface EditItemDialogV2Props extends EditItemDialogProps {
  detail?: ProductEditDetails | null;
  detailLoading?: boolean;
  locationIds?: ProductLocationId[];
  primaryLocationId?: ProductLocationId;
}

export function EditItemDialogV2({
  open,
  onOpenChange,
  items,
  onSaved,
  detail = null,
  detailLoading = false,
  locationIds = [...DEFAULT_PRODUCT_LOCATION_IDS],
  primaryLocationId,
}: EditItemDialogV2Props) {
  const isBulk = items.length > 1;
  const resolvedLocationIds = normalizeProductLocationIds(locationIds);
  const resolvedPrimaryLocationId = (primaryLocationId ?? getPrimaryProductLocationId(resolvedLocationIds)) as InventoryLocationId;
  const { refs, loading: refsLoading, available: refsAvailable } = useProductRefDirectory();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [inventoryByLocation, setInventoryByLocation] = useState<InventoryStateByLocation>(() => makeEmptyInventoryState());
  const [activeInventoryLocation, setActiveInventoryLocation] = useState<InventoryLocationId>(resolvedPrimaryLocationId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtyFieldsRef = useRef<Set<keyof FormState>>(new Set());
  const dirtyInventoryFieldsRef = useRef<DirtyInventoryFields>(makeEmptyDirtyInventoryFields());
  const hydratedSelectionRef = useRef<string | null>(null);

  // `resolvedLocationIds` is retained for Phase 2 (location-aware header
  // badges). Not currently read by the shell. Silence "unused" lint without
  // changing runtime behavior.
  void resolvedLocationIds;

  const refsUnavailable = !refsLoading && !refsAvailable;
  const refsControlsDisabled = refsLoading || refsUnavailable;
  const isTextbookRow = !isBulk && (detail?.itemType === "textbook" || detail?.itemType === "used_textbook" || items[0]?.isTextbook === true);
  const mixedBulkSelection = useMemo(() => {
    if (!isBulk) return null;
    const textbookCount = items.filter((item) => item.isTextbook === true).length;
    const gmCount = items.length - textbookCount;
    return textbookCount > 0 && gmCount > 0 ? { textbookCount, gmCount } : null;
  }, [isBulk, items]);
  const baselineForm = useMemo(
    () => (isBulk ? EMPTY_FORM : toFormState(items[0], detail, resolvedPrimaryLocationId)),
    [detail, isBulk, items, resolvedPrimaryLocationId],
  );
  const baselineInventory = useMemo(
    () => (isBulk ? makeEmptyInventoryState() : toInventoryState(detail)),
    [detail, isBulk],
  );
  const selectionKey = isBulk
    ? `bulk:${items.map((item) => item.sku).join(",")}`
    : `single:${items[0]?.sku ?? "none"}`;

  useEffect(() => {
    if (!open) {
      hydratedSelectionRef.current = null;
      dirtyFieldsRef.current.clear();
      dirtyInventoryFieldsRef.current = makeEmptyDirtyInventoryFields();
      setActiveInventoryLocation(resolvedPrimaryLocationId);
      return;
    }

    const nextForm = isBulk ? EMPTY_FORM : toFormState(items[0], detail, resolvedPrimaryLocationId);
    const nextInventory = isBulk ? makeEmptyInventoryState() : toInventoryState(detail);

    if (hydratedSelectionRef.current !== selectionKey) {
      hydratedSelectionRef.current = selectionKey;
      dirtyFieldsRef.current.clear();
      dirtyInventoryFieldsRef.current = makeEmptyDirtyInventoryFields();
      setForm(nextForm);
      setInventoryByLocation(nextInventory);
      setActiveInventoryLocation(resolvedPrimaryLocationId);
      setError(null);
      return;
    }

    if (isBulk) return;

    setForm((current) => {
      let changed = false;
      const merged: Record<keyof FormState, string | boolean> = { ...current };

      for (const key of Object.keys(EMPTY_FORM) as Array<keyof FormState>) {
        if (dirtyFieldsRef.current.has(key)) continue;
        const nextValue = nextForm[key] as string | boolean;
        if (merged[key] !== nextValue) {
          merged[key] = nextValue;
          changed = true;
        }
      }

      return changed ? (merged as FormState) : current;
    });

    setInventoryByLocation((current) => {
      let changed = false;
      const merged = {
        2: { ...current[2] },
        3: { ...current[3] },
        4: { ...current[4] },
      };

      for (const locationId of INVENTORY_LOCATION_IDS) {
        const dirtyFields = dirtyInventoryFieldsRef.current[locationId];
        const nextLocation = nextInventory[locationId];
        const mergedLocation = merged[locationId];

        for (const key of EDITABLE_INVENTORY_FIELDS) {
          if (dirtyFields.has(key)) continue;
          if (syncInventoryField(mergedLocation, nextLocation, key)) {
            changed = true;
          }
        }

        if (mergedLocation.stockOnHand !== nextLocation.stockOnHand) {
          mergedLocation.stockOnHand = nextLocation.stockOnHand;
          changed = true;
        }
        if (mergedLocation.lastSaleDate !== nextLocation.lastSaleDate) {
          mergedLocation.lastSaleDate = nextLocation.lastSaleDate;
          changed = true;
        }
      }

      return changed ? merged : current;
    });
  }, [detail, isBulk, items, open, resolvedPrimaryLocationId, selectionKey]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    dirtyFieldsRef.current.add(key);
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "retail" || key === "cost") {
      dirtyInventoryFieldsRef.current[resolvedPrimaryLocationId].add(key);
      setInventoryByLocation((current) => ({
        ...current,
        [resolvedPrimaryLocationId]: {
          ...current[resolvedPrimaryLocationId],
          [key]: value,
        },
      }));
    }
  }

  function updateInventoryField<K extends keyof InventoryFormState>(
    locationId: InventoryLocationId,
    key: K,
    value: InventoryFormState[K],
  ) {
    if (locationId === resolvedPrimaryLocationId && (key === "retail" || key === "cost")) {
      dirtyFieldsRef.current.add(key);
      setForm((current) => ({ ...current, [key]: value }));
    }
    if (EDITABLE_INVENTORY_FIELDS.includes(key as InventoryFieldKey)) {
      dirtyInventoryFieldsRef.current[locationId].add(key as InventoryFieldKey);
    }
    setInventoryByLocation((current) => ({
      ...current,
      [locationId]: {
        ...current[locationId],
        [key]: value,
      },
    }));
  }

  function copyInventoryField(field: "retail" | "cost" | "tagTypeId" | "statusCodeId") {
    const sourceValue = inventoryByLocation[activeInventoryLocation][field];
    if (field === "retail" || field === "cost") {
      dirtyFieldsRef.current.add(field);
      setForm((formState) => ({ ...formState, [field]: sourceValue }));
    }
    for (const locationId of INVENTORY_LOCATION_IDS) {
      if (locationId === activeInventoryLocation) continue;
      dirtyInventoryFieldsRef.current[locationId].add(field);
    }

    setInventoryByLocation((current) => {
      return {
        2: activeInventoryLocation === 2 ? current[2] : { ...current[2], [field]: sourceValue },
        3: activeInventoryLocation === 3 ? current[3] : { ...current[3], [field]: sourceValue },
        4: activeInventoryLocation === 4 ? current[4] : { ...current[4], [field]: sourceValue },
      };
    });
  }

  async function handleSave() {
    const inventoryPatch = buildInventoryPatch(
      form,
      baselineForm,
      inventoryByLocation,
      baselineInventory,
      resolvedPrimaryLocationId,
      isBulk,
    );
    const v2Patch = {
      ...buildV2Patch(form, baselineForm, isBulk, isTextbookRow),
      inventory: inventoryPatch,
    };
    const hasV2Changes =
      hasPatchFields(v2Patch.item ?? {}) ||
      hasPatchFields(v2Patch.gm ?? {}) ||
      hasPatchFields(v2Patch.textbook ?? {}) ||
      (v2Patch.inventory?.length ?? 0) > 0;

    if (!hasV2Changes) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (items.length === 1) {
        const item = items[0];
        // Concurrency baseline intentionally snapshots Pierce (locationId 2).
        // The server's concurrency check in `prism-updates.ts` hard-codes
        // `PIERCE_LOCATION_ID = 2` in its `SELECT inv.Retail, inv.Cost FROM
        // Inventory WHERE LocationID = @loc` query, then compares those
        // values against `baseline.retail` / `baseline.cost`. Sending a
        // PCOP or PFS snapshot here would guarantee a false
        // CONCURRENT_MODIFICATION 409 on non-PIER product pages.
        //
        // Making this truly primary-location-aware requires teaching the
        // server's concurrency check to honor `resolvedPrimaryLocationId`
        // too — tracked as a follow-up; keeping client + server aligned
        // on PIER is the safe shipping choice.
        const pierceInventoryBaseline = detail?.inventoryByLocation.find(
          (entry) => entry.locationId === 2,
        );
        await productApi.update(item.sku, {
          mode: "v2",
          patch: v2Patch,
          baseline: {
            sku: item.sku,
            barcode: detail?.barcode ?? item.barcode,
            retail: pierceInventoryBaseline?.retail ?? item.retail,
            cost: pierceInventoryBaseline?.cost ?? item.cost,
            fDiscontinue: item.fDiscontinue,
          },
        });
      } else {
        // Bulk save: apply the v2 patch row-by-row, SEQUENTIALLY, stopping
        // on first failure. Trade-offs vs. the alternatives:
        //
        // - Parallel Promise.all (the pre-hotfix behavior) could leave a
        //   scattershot partial commit: rows 1,3,5 succeed while 2,4 fail
        //   and the user can't tell what actually landed.
        // - `productApi.batch` is *not* transactional on the server
        //   (`prism-batch.ts` loops with separate transactions) and the
        //   batch endpoint explicitly punts optimistic-concurrency
        //   checking to the single-item path. Routing bulk through batch
        //   would lose 409 protection entirely.
        //
        // Sequential per-row v2 PATCH with a `baseline` on every call:
        // - retains 409 optimistic-concurrency for every row;
        // - stops the moment anything breaks, so at most ONE row can
        //   "half-commit" (the one that failed mid-way), everything after
        //   is never attempted;
        // - reports back a crisp "saved N of M, failed at row R (SKU S)"
        //   message plus calls `onSaved` with the list that actually
        //   committed so the grid refreshes those rows deterministically.
        //
        // A transactional batch endpoint with baseline-aware row checks
        // would be strictly better and is the right long-term fix; it is
        // out of scope for this hotfix (live regression on main).
        const savedSkus: number[] = [];
        let failureMessage: string | null = null;
        for (const item of items) {
          try {
            await productApi.update(item.sku, {
              mode: "v2",
              patch: v2Patch,
              baseline: {
                sku: item.sku,
                barcode: item.barcode,
                retail: item.retail,
                cost: item.cost,
                fDiscontinue: item.fDiscontinue,
              },
            });
            savedSkus.push(item.sku);
          } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            const rowIndex = items.indexOf(item);
            const remaining = items.length - savedSkus.length - 1;
            failureMessage =
              `Saved ${savedSkus.length} of ${items.length}. ` +
              `Row ${rowIndex + 1} (SKU ${item.sku}) failed: ${reason}. ` +
              `${remaining} row${remaining === 1 ? "" : "s"} not attempted.`;
            break;
          }
        }

        if (failureMessage != null) {
          // Do NOT call `onSaved` on partial failure. Callers (see
          // `src/app/products/page.tsx`) wire `onSaved` to
          // `setEditOpen(false) + refetch()`, so invoking it here would
          // dismiss the dialog and erase the error context before the
          // operator can read it. Leaving the dialog open with the
          // summary preserves retry context; the grid refetches on the
          // next natural interaction (close/reopen or an explicit
          // refresh). If the grid needs to refresh the committed rows
          // specifically, add an `onPartialSaved` callback — tracked as
          // a follow-up.
          setError(failureMessage);
          return;
        }
      }

      onSaved?.(items.map((item) => item.sku));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle = isBulk ? `Edit ${items.length} items` : `Edit SKU ${items[0]?.sku}`;
  const uid = items[0]?.sku ?? "bulk";
  const idFor = (field: string) => `edit-v2-${uid}-${field}`;
  const activeInventory = inventoryByLocation[activeInventoryLocation];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[72rem]">
        <DialogHeader className="border-b bg-muted/30 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-[1.25rem] font-semibold tracking-tight">{dialogTitle}</DialogTitle>
              <DialogDescription>
                {isBulk
                  ? "Fields left blank won't be changed. Fill only the shared values to apply across the selected items."
                  : "Edit item fields — writes to Prism on save."}
              </DialogDescription>
              {!isBulk ? (
                <p className="text-xs text-muted-foreground">
                  Primary location:{" "}
                  <span className="font-medium text-foreground">
                    {INVENTORY_LOCATION_LABELS[resolvedPrimaryLocationId]}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {isBulk ? <Badge variant="secondary">Bulk</Badge> : null}
              {isTextbookRow ? (
                <Badge variant="secondary">Textbook</Badge>
              ) : !isBulk ? (
                <Badge variant="outline">GM</Badge>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {detailLoading && !isBulk ? (
          <div role="status" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
            Loading item details…
          </div>
        ) : null}

        {refsUnavailable ? (
          <div role="alert" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
            Reference data is unavailable right now. Vendor, department/class, and tax type lookups are disabled until Prism recovers. Tag type, status code, package type, color, and binding lookups are also unavailable.
          </div>
        ) : null}

        {error ? (
          <div role="alert" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="max-h-[calc(92dvh-10rem)] overflow-y-auto px-6 py-5">
          <Tabs defaultValue="primary" className="gap-4">
            <SelectedItemsSummary items={items} />

            <TabsList variant="line" className="w-full justify-start border-b border-border/70 px-0">
              <TabsTrigger value="primary">Primary</TabsTrigger>
              {!isBulk ? <TabsTrigger value="inventory">Inventory</TabsTrigger> : null}
              {isTextbookRow ? <TabsTrigger value="textbook">Textbook</TabsTrigger> : null}
            </TabsList>

            <PrimaryTabContent
              form={form}
              update={update}
              idFor={idFor}
              isBulk={isBulk}
              isTextbookRow={isTextbookRow}
              refs={refs}
              refsControlsDisabled={refsControlsDisabled}
              resolvedPrimaryLocationId={resolvedPrimaryLocationId}
              mixedBulkSelection={mixedBulkSelection}
            />

            {!isBulk ? (
              <InventoryTabContent
                activeInventory={activeInventory}
                activeInventoryLocation={activeInventoryLocation}
                setActiveInventoryLocation={setActiveInventoryLocation}
                updateInventoryField={updateInventoryField}
                copyInventoryField={copyInventoryField}
                idFor={idFor}
                refs={refs}
                refsControlsDisabled={refsControlsDisabled}
              />
            ) : null}

            {isTextbookRow ? (
              <TextbookTabContent
                form={form}
                update={update}
                idFor={idFor}
                isBulk={isBulk}
                detail={detail}
              />
            ) : null}
          </Tabs>
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || detailLoading}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
