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
import { toast } from "sonner";
import {
  DEFAULT_PRODUCT_LOCATION_IDS,
  getPrimaryProductLocationId,
  normalizeProductLocationIds,
  type ProductLocationId,
} from "@/domains/product/location-filters";
import type { ProductEditDetails, ProductEditPatchV2, SelectedProduct } from "@/domains/product/types";
import { useProductRefDirectory } from "@/domains/product/vendor-directory";
import type { EditItemDialogProps, SavedScopedItemsOptions } from "../edit-item-dialog-legacy";
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

function formatMirrorWarning(
  mirrorErrors?: Array<{ sku: number }>,
  mirrorRefreshDeferred = false,
): string | null {
  if ((mirrorErrors?.length ?? 0) > 0) {
    return `Saved in Prism, but the product mirror did not refresh for SKU ${mirrorErrors!.map((entry) => entry.sku).join(", ")}. Browse data may stay stale until the next sync.`;
  }
  if (mirrorRefreshDeferred) {
    return "Saved in Prism. The browse mirror is refreshing in the background, so browse data may stay stale briefly.";
  }
  return null;
}

export function EditItemDialogV2({
  open,
  onOpenChange,
  items,
  onSaved,
  onSavedScopedItems,
  knownScopedItemsByKey,
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

  async function saveSingleItem(v2Patch: ProductEditPatchV2): Promise<{ mirrorWarning: string | null }> {
    const item = items[0];
    // Source retail/cost from whatever `resolvedPrimaryLocationId` resolves to
    // (PIER/PCOP/PFS). Falls back to `item.retail` / `item.cost` (which already
    // reflects the browse row's primary-location values) if the detail slice
    // isn't loaded yet. Server's concurrency SELECT uses
    // `baseline.primaryLocationId` as `@loc`, so client and server read the
    // same row.
    const primarySlice = detail?.inventoryByLocation.find(
      (entry) => entry.locationId === resolvedPrimaryLocationId,
    );
    const result = await productApi.update(item.sku, {
      mode: "v2",
      patch: v2Patch,
      baseline: {
        sku: item.sku,
        barcode: detail?.barcode ?? item.barcode,
        retail: primarySlice?.retail ?? item.retail,
        cost: primarySlice?.cost ?? item.cost,
        fDiscontinue: item.fDiscontinue,
        primaryLocationId: resolvedPrimaryLocationId,
      },
    });
    return { mirrorWarning: formatMirrorWarning(result.mirrorErrors) };
  }

  async function saveBulk(
    v2Patch: ProductEditPatchV2,
  ): Promise<{ validationError: string | null; mirrorWarning: string | null }> {
    // Atomic bulk save: ONE server call wraps all rows in one Prism
    // transaction. Zero partial-commit hazard — either every row commits
    // or none do. Any failure throws; caller's catch surfaces the error
    // and leaves the dialog open so the operator can retry in place.
    const result = await productApi.batch({
      action: "update",
      rows: items.map((item) => ({
        sku: item.sku,
        isTextbook: item.isTextbook ?? false,
        patch: v2Patch,
        baseline: {
          sku: item.sku,
          barcode: item.barcode,
          retail: item.retail,
          cost: item.cost,
          fDiscontinue: item.fDiscontinue,
          primaryLocationId: resolvedPrimaryLocationId,
        },
      })),
    });
    if ("errors" in result && result.errors.length > 0) {
      return {
        validationError: `Validation failed: ${result.errors.map((e) => `${e.field}: ${e.message}`).join("; ")}`,
        mirrorWarning: null,
      };
    }
    return {
      validationError: null,
      mirrorWarning:
        "mirrorErrors" in result || "mirrorRefreshDeferred" in result
          ? formatMirrorWarning(result.mirrorErrors, result.mirrorRefreshDeferred === true)
          : null,
    };
  }

  function formatSaveError(err: unknown): string {
    const e = err as Error & { code?: string; rowIndex?: number | null; sku?: number | null };
    if (e.code === "CONCURRENT_MODIFICATION") {
      // Bulk path — zero rows committed on failure because the batch is
      // atomic, so retry-in-place is safe after the conflict clears. No
      // need to close and reopen.
      if (e.rowIndex != null && e.sku != null) {
        return (
          `Row ${e.rowIndex + 1} (SKU ${e.sku}) was modified by someone else since you opened this dialog. ` +
          `No changes were saved. Wait for the conflict to clear and click Save again.`
        );
      }
      // Bulk with no row-level detail (unusual — annotation lost upstream).
      // Still safe to retry in place because the batch is atomic.
      if (isBulk) {
        return (
          `Another user modified one of the selected items since you opened this dialog. ` +
          `No changes were saved. Wait for the conflict to clear and click Save again.`
        );
      }
      // Single-item path — the dialog's `detail` snapshot is now stale, so
      // the operator has to close and reopen to refresh it before retry.
      return (
        `This item was modified by someone else since you opened this dialog. ` +
        `No changes were saved. Close and reopen this dialog to see the latest values, then retry.`
      );
    }
    return err instanceof Error ? err.message : String(err);
  }

  function buildSavedScopedItems(v2Patch: ProductEditPatchV2): SelectedProduct[] {
    const itemPatch = v2Patch.item;
    const gmPatch = v2Patch.gm;
    const textbookPatch = v2Patch.textbook;
    const hasGlobalFieldChanges =
      hasPatchFields(itemPatch ?? {}) ||
      hasPatchFields(gmPatch ?? {}) ||
      hasPatchFields(textbookPatch ?? {});
    const cacheLocationIds = new Set<ProductLocationId>([resolvedPrimaryLocationId]);
    for (const inventoryPatch of v2Patch.inventory ?? []) {
      cacheLocationIds.add(inventoryPatch.locationId);
    }

    const savedItems: SelectedProduct[] = [];
    for (const item of items) {
      const nextTitle =
        textbookPatch?.title !== undefined
          ? (textbookPatch.title ?? null)
          : (item.title ?? null);
      const nextDescription = (nextTitle ?? gmPatch?.description ?? item.description ?? "").toUpperCase();
      const detailInventoryByLocation = new Map(
        (detail?.inventoryByLocation ?? []).map((inventory) => [inventory.locationId, inventory] as const),
      );
      const liveDetailLocationIds = new Set(
        (detail?.inventoryByLocation ?? []).map((inventory) => inventory.locationId),
      );
      const itemCacheLocationIds = new Set<ProductLocationId>(cacheLocationIds);
      if (hasGlobalFieldChanges) {
        for (const knownScopedItem of Array.from(knownScopedItemsByKey?.values() ?? [])) {
          if (
            knownScopedItem.sku === item.sku &&
            knownScopedItem.pricingLocationId != null &&
            liveDetailLocationIds.has(knownScopedItem.pricingLocationId)
          ) {
            itemCacheLocationIds.add(knownScopedItem.pricingLocationId);
          }
        }
      }

      for (const locationId of Array.from(itemCacheLocationIds)) {
        const inventoryPatch = v2Patch.inventory?.find((entry) => entry.locationId === locationId);
        const inventoryDetail = detailInventoryByLocation.get(locationId);
        const knownRetail =
          inventoryPatch?.retail !== undefined
            ? (inventoryPatch.retail ?? null)
            : inventoryDetail
              ? (inventoryDetail.retail ?? null)
              : (
                locationId === resolvedPrimaryLocationId
                  ? (item.retail ?? null)
                  : null
              );
        const knownCost =
          inventoryPatch?.cost !== undefined
            ? (inventoryPatch.cost ?? null)
            : inventoryDetail
              ? (inventoryDetail.cost ?? null)
              : (
                locationId === resolvedPrimaryLocationId
                  ? (item.cost ?? null)
                  : null
              );
        const hasKnownRetail =
          inventoryPatch?.retail !== undefined ||
          knownRetail != null;
        const hasKnownCost =
          inventoryPatch?.cost !== undefined ||
          knownCost != null;
        if (!hasKnownRetail || !hasKnownCost) {
          continue;
        }

        savedItems.push({
          sku: item.sku,
          description: nextDescription,
          retailPrice: knownRetail,
          cost: knownCost,
          pricingLocationId: locationId,
          barcode:
            itemPatch?.barcode !== undefined
              ? (itemPatch.barcode ?? null)
              : (item.barcode ?? null),
          author:
            textbookPatch?.author !== undefined
              ? (textbookPatch.author ?? null)
              : (item.author ?? null),
          title: nextTitle,
          isbn:
            textbookPatch?.isbn !== undefined
              ? (textbookPatch.isbn ?? null)
              : (item.isbn ?? null),
          edition:
            textbookPatch?.edition !== undefined
              ? (textbookPatch.edition ?? null)
              : (item.edition ?? null),
          catalogNumber:
            gmPatch?.catalogNumber !== undefined
              ? (gmPatch.catalogNumber ?? null)
              : (item.catalogNumber ?? null),
          vendorId:
            itemPatch?.vendorId !== undefined
              ? (itemPatch.vendorId ?? null)
              : (item.vendorId ?? null),
          itemType: item.itemType ?? (item.isTextbook ? "textbook" : "general_merchandise"),
          fDiscontinue:
            itemPatch?.fDiscontinue !== undefined
              ? itemPatch.fDiscontinue
              : item.fDiscontinue,
        });
      }
    }

    return savedItems;
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
    const v2Patch: ProductEditPatchV2 = {
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
      let mirrorWarning: string | null = null;
      if (items.length === 1) {
        ({ mirrorWarning } = await saveSingleItem(v2Patch));
      } else {
        const bulkResult = await saveBulk(v2Patch);
        const { validationError } = bulkResult;
        if (validationError) {
          setError(validationError);
          return;
        }
        mirrorWarning = bulkResult.mirrorWarning;
      }
      if (mirrorWarning) {
        toast.error(mirrorWarning);
      }

      const savedScopedItemsOptions: SavedScopedItemsOptions = {
        retainUntilMatch: mirrorWarning != null,
      };
      onSavedScopedItems?.(buildSavedScopedItems(v2Patch), savedScopedItemsOptions);
      onSaved?.(items.map((item) => item.sku));
      onOpenChange(false);
    } catch (err) {
      setError(formatSaveError(err));
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
          <Button
            onClick={() => void handleSave()}
            disabled={saving || detailLoading}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
