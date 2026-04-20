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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productApi } from "@/domains/product/api-client";
import type { ProductEditDetails, ProductEditPatchV2 } from "@/domains/product/types";
import { useProductRefDirectory } from "@/domains/product/vendor-directory";
import type { EditItemDialogProps } from "./edit-item-dialog-legacy";
import { buildPatch } from "./edit-item-dialog-legacy";
import { ItemRefSelectField } from "./item-ref-selects";

export interface EditItemDialogV2Props extends EditItemDialogProps {
  detail?: ProductEditDetails | null;
  detailLoading?: boolean;
}

type FormState = {
  description: string;
  barcode: string;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  retail: string;
  cost: string;
  catalogNumber: string;
  comment: string;
  fDiscontinue: boolean;
  packageType: string;
  unitsPerPack: string;
  imageUrl: string;
  weight: string;
  altVendorId: string;
  mfgId: string;
  size: string;
  colorId: string;
  styleId: string;
  itemSeasonCodeId: string;
  orderIncrement: string;
  fListPriceFlag: boolean;
  fPerishable: boolean;
  fIdRequired: boolean;
  minOrderQtyItem: string;
  usedDccId: string;
};

const EMPTY_FORM: FormState = {
  description: "",
  barcode: "",
  vendorId: "",
  dccId: "",
  itemTaxTypeId: "",
  retail: "",
  cost: "",
  catalogNumber: "",
  comment: "",
  fDiscontinue: false,
  packageType: "",
  unitsPerPack: "",
  imageUrl: "",
  weight: "",
  altVendorId: "",
  mfgId: "",
  size: "",
  colorId: "",
  styleId: "",
  itemSeasonCodeId: "",
  orderIncrement: "",
  fListPriceFlag: false,
  fPerishable: false,
  fIdRequired: false,
  minOrderQtyItem: "",
  usedDccId: "",
};

const INVENTORY_LOCATION_IDS = [2, 3, 4] as const;
type InventoryLocationId = (typeof INVENTORY_LOCATION_IDS)[number];
type InventoryFieldKey =
  | "retail"
  | "cost"
  | "expectedCost"
  | "tagTypeId"
  | "statusCodeId"
  | "estSales"
  | "estSalesLocked"
  | "fInvListPriceFlag"
  | "fTxWantListFlag"
  | "fTxBuybackListFlag"
  | "fNoReturns";

const EDITABLE_INVENTORY_FIELDS = [
  "retail",
  "cost",
  "expectedCost",
  "tagTypeId",
  "statusCodeId",
  "estSales",
  "estSalesLocked",
  "fInvListPriceFlag",
  "fTxWantListFlag",
  "fTxBuybackListFlag",
  "fNoReturns",
] as const satisfies readonly InventoryFieldKey[];

type InventoryFormState = {
  retail: string;
  cost: string;
  expectedCost: string;
  tagTypeId: string;
  statusCodeId: string;
  estSales: string;
  estSalesLocked: boolean;
  fInvListPriceFlag: boolean;
  fTxWantListFlag: boolean;
  fTxBuybackListFlag: boolean;
  fNoReturns: boolean;
  stockOnHand: string;
  lastSaleDate: string;
};

type InventoryStateByLocation = Record<InventoryLocationId, InventoryFormState>;
type DirtyInventoryFields = Record<InventoryLocationId, Set<InventoryFieldKey>>;

const EMPTY_INVENTORY_LOCATION: InventoryFormState = {
  retail: "",
  cost: "",
  expectedCost: "",
  tagTypeId: "",
  statusCodeId: "",
  estSales: "",
  estSalesLocked: false,
  fInvListPriceFlag: false,
  fTxWantListFlag: false,
  fTxBuybackListFlag: false,
  fNoReturns: false,
  stockOnHand: "",
  lastSaleDate: "",
};

const INVENTORY_LOCATION_LABELS: Record<InventoryLocationId, "PIER" | "PCOP" | "PFS"> = {
  2: "PIER",
  3: "PCOP",
  4: "PFS",
};

function makeEmptyInventoryState(): InventoryStateByLocation {
  return {
    2: { ...EMPTY_INVENTORY_LOCATION },
    3: { ...EMPTY_INVENTORY_LOCATION },
    4: { ...EMPTY_INVENTORY_LOCATION },
  };
}

function makeEmptyDirtyInventoryFields(): DirtyInventoryFields {
  return {
    2: new Set<InventoryFieldKey>(),
    3: new Set<InventoryFieldKey>(),
    4: new Set<InventoryFieldKey>(),
  };
}

function toInventoryLocationState(
  detail: ProductEditDetails | null | undefined,
  locationId: InventoryLocationId,
): InventoryFormState {
  const row = detail?.inventoryByLocation.find((entry) => entry.locationId === locationId);
  return {
    retail: row?.retail != null ? String(row.retail) : "",
    cost: row?.cost != null ? String(row.cost) : "",
    expectedCost: row?.expectedCost != null ? String(row.expectedCost) : "",
    tagTypeId: row?.tagTypeId != null ? String(row.tagTypeId) : "",
    statusCodeId: row?.statusCodeId != null ? String(row.statusCodeId) : "",
    estSales: row?.estSales != null ? String(row.estSales) : "",
    estSalesLocked: row?.estSalesLocked ?? false,
    fInvListPriceFlag: row?.fInvListPriceFlag ?? false,
    fTxWantListFlag: row?.fTxWantListFlag ?? false,
    fTxBuybackListFlag: row?.fTxBuybackListFlag ?? false,
    fNoReturns: row?.fNoReturns ?? false,
    stockOnHand: row?.stockOnHand != null ? String(row.stockOnHand) : "",
    lastSaleDate: row?.lastSaleDate ?? "",
  };
}

function toInventoryState(detail: ProductEditDetails | null | undefined): InventoryStateByLocation {
  return {
    2: toInventoryLocationState(detail, 2),
    3: toInventoryLocationState(detail, 3),
    4: toInventoryLocationState(detail, 4),
  };
}

function toFormState(item: EditItemDialogProps["items"][number] | undefined, detail?: ProductEditDetails | null): FormState {
  return {
    description: detail?.description ?? item?.description ?? "",
    barcode: detail?.barcode ?? item?.barcode ?? "",
    vendorId: detail?.vendorId ? String(detail.vendorId) : item?.vendorId ? String(item.vendorId) : "",
    dccId: detail?.dccId ? String(detail.dccId) : item?.dccId ? String(item.dccId) : "",
    itemTaxTypeId: detail?.itemTaxTypeId ? String(detail.itemTaxTypeId) : item?.itemTaxTypeId ? String(item.itemTaxTypeId) : "",
    retail: detail?.retail != null ? String(detail.retail) : item?.retail != null ? String(item.retail) : "",
    cost: detail?.cost != null ? String(detail.cost) : item?.cost != null ? String(item.cost) : "",
    catalogNumber: detail?.catalogNumber ?? item?.catalogNumber ?? "",
    comment: detail?.comment ?? item?.comment ?? "",
    fDiscontinue: (detail?.fDiscontinue ?? item?.fDiscontinue ?? 0) === 1,
    packageType: detail?.packageType ?? item?.packageType ?? "",
    unitsPerPack: detail?.unitsPerPack != null ? String(detail.unitsPerPack) : item?.unitsPerPack != null ? String(item.unitsPerPack) : "",
    imageUrl: detail?.imageUrl ?? "",
    weight: detail?.weight != null ? String(detail.weight) : "",
    altVendorId: detail?.altVendorId ? String(detail.altVendorId) : "",
    mfgId: detail?.mfgId ? String(detail.mfgId) : "",
    size: detail?.size ?? "",
    colorId: detail?.colorId ? String(detail.colorId) : "",
    styleId: detail?.styleId ? String(detail.styleId) : "",
    itemSeasonCodeId: detail?.itemSeasonCodeId ? String(detail.itemSeasonCodeId) : "",
    orderIncrement: detail?.orderIncrement != null ? String(detail.orderIncrement) : "",
    fListPriceFlag: detail?.fListPriceFlag ?? false,
    fPerishable: detail?.fPerishable ?? false,
    fIdRequired: detail?.fIdRequired ?? false,
    minOrderQtyItem: detail?.minOrderQtyItem != null ? String(detail.minOrderQtyItem) : "",
    usedDccId: detail?.usedDccId ? String(detail.usedDccId) : "",
  };
}

function optionalString(value: string, isBulk: boolean): string | null | undefined {
  if (value !== "") return value;
  return isBulk ? undefined : null;
}

function hasPatchFields<T extends object>(value: T): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

function buildLegacyCompatiblePatch(form: FormState, baseline: FormState, isBulk: boolean) {
  const rawPatch = buildPatch(baseline as Record<string, unknown>, form as Record<string, unknown>);
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawPatch)) {
    if (isBulk && value === "") continue;

    switch (key) {
      case "description":
        patch.description = value;
        break;
      case "barcode":
        patch.barcode = value;
        break;
      case "vendorId":
      case "dccId":
      case "itemTaxTypeId":
      case "unitsPerPack":
        patch[key] = value === "" ? undefined : Number(value);
        break;
      case "retail":
      case "cost":
      case "weight":
        patch[key] = Number(value);
        break;
      case "catalogNumber":
      case "comment":
      case "imageUrl":
      case "packageType":
        patch[key] = optionalString(String(value), isBulk);
        break;
      case "fDiscontinue":
        patch.fDiscontinue = value ? 1 : 0;
        break;
      default:
        break;
    }
  }

  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) delete patch[key];
  }

  return patch;
}

function buildV2Patch(form: FormState, baseline: FormState, isBulk: boolean): ProductEditPatchV2 {
  const rawPatch = buildPatch(baseline as Record<string, unknown>, form as Record<string, unknown>);
  const item: NonNullable<ProductEditPatchV2["item"]> = {};
  const gm: NonNullable<ProductEditPatchV2["gm"]> = {};

  for (const [key, value] of Object.entries(rawPatch)) {
    if (isBulk && value === "") continue;

    switch (key) {
      case "description":
        gm.description = String(value);
        break;
      case "barcode":
        item.barcode = value === "" ? null : String(value);
        break;
      case "vendorId":
        item.vendorId = value === "" ? undefined : Number(value);
        break;
      case "dccId":
        item.dccId = value === "" ? undefined : Number(value);
        break;
      case "itemTaxTypeId":
        item.itemTaxTypeId = value === "" ? undefined : Number(value);
        break;
      case "unitsPerPack":
        gm.unitsPerPack = value === "" ? undefined : Number(value);
        break;
      case "weight":
        item.weight = Number(value);
        break;
      case "catalogNumber":
        gm.catalogNumber = optionalString(String(value), isBulk);
        break;
      case "comment":
        item.comment = optionalString(String(value), isBulk);
        break;
      case "imageUrl":
        gm.imageUrl = optionalString(String(value), isBulk);
        break;
      case "packageType":
        gm.packageType = optionalString(String(value), isBulk);
        break;
      case "fDiscontinue":
        item.fDiscontinue = value ? 1 : 0;
        break;
      default:
        break;
    }
  }

  return {
    item: hasPatchFields(item) ? item : undefined,
    gm: hasPatchFields(gm) ? gm : undefined,
  };
}

function buildInventoryPatch(
  form: FormState,
  baselineForm: FormState,
  inventory: InventoryStateByLocation,
  baselineInventory: InventoryStateByLocation,
  isBulk: boolean,
): NonNullable<ProductEditPatchV2["inventory"]> | undefined {
  if (isBulk) return undefined;

  const patch: NonNullable<ProductEditPatchV2["inventory"]> = [];

  for (const locationId of INVENTORY_LOCATION_IDS) {
    const current = inventory[locationId];
    const baseline = baselineInventory[locationId];
    const entry: Partial<NonNullable<ProductEditPatchV2["inventory"]>[number]> = { locationId };

    const retailSource = locationId === 2 ? form.retail : current.retail;
    const retailBaseline = locationId === 2 ? baselineForm.retail : baseline.retail;
    if (retailSource !== retailBaseline && retailSource !== "") {
      entry.retail = Number(retailSource);
    }

    const costSource = locationId === 2 ? form.cost : current.cost;
    const costBaseline = locationId === 2 ? baselineForm.cost : baseline.cost;
    if (costSource !== costBaseline && costSource !== "") {
      entry.cost = Number(costSource);
    }

    if (current.expectedCost !== baseline.expectedCost && current.expectedCost !== "") {
      entry.expectedCost = Number(current.expectedCost);
    }
    if (current.tagTypeId !== baseline.tagTypeId && current.tagTypeId !== "") {
      entry.tagTypeId = Number(current.tagTypeId);
    }
    if (current.statusCodeId !== baseline.statusCodeId && current.statusCodeId !== "") {
      entry.statusCodeId = Number(current.statusCodeId);
    }
    if (current.estSales !== baseline.estSales && current.estSales !== "") {
      entry.estSales = Number(current.estSales);
    }
    if (current.estSalesLocked !== baseline.estSalesLocked) {
      entry.estSalesLocked = current.estSalesLocked;
    }
    if (current.fInvListPriceFlag !== baseline.fInvListPriceFlag) {
      entry.fInvListPriceFlag = current.fInvListPriceFlag;
    }
    if (current.fTxWantListFlag !== baseline.fTxWantListFlag) {
      entry.fTxWantListFlag = current.fTxWantListFlag;
    }
    if (current.fTxBuybackListFlag !== baseline.fTxBuybackListFlag) {
      entry.fTxBuybackListFlag = current.fTxBuybackListFlag;
    }
    if (current.fNoReturns !== baseline.fNoReturns) {
      entry.fNoReturns = current.fNoReturns;
    }

    if (Object.keys(entry).length > 1) {
      patch.push(entry as NonNullable<ProductEditPatchV2["inventory"]>[number]);
    }
  }

  return patch.length > 0 ? patch : undefined;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyCheckbox({
  checked,
  label,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2.5 text-sm">
      <Checkbox checked={checked} onCheckedChange={(next) => onCheckedChange(next === true)} disabled={disabled} aria-label={label} />
      <span className="leading-5">{label}</span>
    </label>
  );
}

function ReadOnlyValueField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  return (
    <Field id={id} label={label}>
      <Input id={id} value={value} disabled readOnly />
    </Field>
  );
}

function BooleanSelectField({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field id={id} label={label}>
      <Select value={value ? "1" : "0"} onValueChange={(next) => onChange(next === "1")} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[var(--anchor-width)]">
          <SelectItem value="1">Enabled</SelectItem>
          <SelectItem value="0">Disabled</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function EditItemDialogV2({
  open,
  onOpenChange,
  items,
  onSaved,
  detail = null,
  detailLoading = false,
}: EditItemDialogV2Props) {
  const isBulk = items.length > 1;
  const { refs, loading: refsLoading, available: refsAvailable } = useProductRefDirectory();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [inventoryByLocation, setInventoryByLocation] = useState<InventoryStateByLocation>(() => makeEmptyInventoryState());
  const [activeInventoryLocation, setActiveInventoryLocation] = useState<InventoryLocationId>(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtyFieldsRef = useRef<Set<keyof FormState>>(new Set());
  const dirtyInventoryFieldsRef = useRef<DirtyInventoryFields>(makeEmptyDirtyInventoryFields());
  const hydratedSelectionRef = useRef<string | null>(null);

  const refsUnavailable = !refsLoading && !refsAvailable;
  const refsControlsDisabled = refsLoading || refsUnavailable;
  const baselineForm = useMemo(() => (isBulk ? EMPTY_FORM : toFormState(items[0], detail)), [detail, isBulk, items]);
  const baselineInventory = useMemo(() => (isBulk ? makeEmptyInventoryState() : toInventoryState(detail)), [detail, isBulk]);
  const selectionKey = isBulk
    ? `bulk:${items.map((item) => item.sku).join(",")}`
    : `single:${items[0]?.sku ?? "none"}`;

  useEffect(() => {
    if (!open) {
      hydratedSelectionRef.current = null;
      dirtyFieldsRef.current.clear();
      dirtyInventoryFieldsRef.current = makeEmptyDirtyInventoryFields();
      setActiveInventoryLocation(2);
      return;
    }

    const nextForm = isBulk ? EMPTY_FORM : toFormState(items[0], detail);
    const nextInventory = isBulk ? makeEmptyInventoryState() : toInventoryState(detail);

    if (hydratedSelectionRef.current !== selectionKey) {
      hydratedSelectionRef.current = selectionKey;
      dirtyFieldsRef.current.clear();
      dirtyInventoryFieldsRef.current = makeEmptyDirtyInventoryFields();
      setForm(nextForm);
      setInventoryByLocation(nextInventory);
      setActiveInventoryLocation(2);
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
          if (mergedLocation[key] !== nextLocation[key]) {
            mergedLocation[key] = nextLocation[key];
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
  }, [detail, isBulk, items, open, selectionKey]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    dirtyFieldsRef.current.add(key);
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "retail" || key === "cost") {
      dirtyInventoryFieldsRef.current[2].add(key);
      setInventoryByLocation((current) => ({
        ...current,
        2: {
          ...current[2],
          [key]: value,
        },
      }));
    }
  }

  function updateInventoryField<K extends keyof InventoryFormState>(locationId: InventoryLocationId, key: K, value: InventoryFormState[K]) {
    if (locationId === 2 && (key === "retail" || key === "cost")) {
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
    const inventoryPatch = buildInventoryPatch(form, baselineForm, inventoryByLocation, baselineInventory, isBulk);
    const v2Patch = {
      ...buildV2Patch(form, baselineForm, isBulk),
      inventory: inventoryPatch,
    };
    const hasV2Changes =
      hasPatchFields(v2Patch.item ?? {}) ||
      hasPatchFields(v2Patch.gm ?? {}) ||
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
      } else {
        const legacyPatch = buildLegacyCompatiblePatch(form, baselineForm, true);
        const result = await productApi.batch({
          action: "update",
          rows: items.map((item) => ({
            sku: item.sku,
            patch: legacyPatch,
            isTextbook: !!item.isTextbook,
          })),
        });
        if ("errors" in result && result.errors.length > 0) {
          setError(result.errors.map((entry) => `Row ${entry.rowIndex + 1}: ${entry.message}`).join("; "));
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
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[58rem]">
        <DialogHeader className="border-b bg-muted/30 px-6 py-5">
          <DialogTitle className="text-[1.2rem] font-semibold tracking-tight">{dialogTitle}</DialogTitle>
          <DialogDescription>
            {isBulk
              ? "Fields left blank won't be changed. Fill only the shared values you want to apply across the selected items."
              : "Phase 5 adds the inventory editor alongside the GM and shared item fields."}
          </DialogDescription>
        </DialogHeader>

        {detailLoading && !isBulk ? (
          <div role="status" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
            Loading item details…
          </div>
        ) : null}

        {refsUnavailable ? (
          <div role="alert" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
            Reference data is unavailable right now. Vendor, department / class, tax type, tag type, status code, package type, and color lookups are disabled until Prism recovers.
          </div>
        ) : null}

        {error ? (
          <div role="alert" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="max-h-[calc(92vh-12rem)] overflow-y-auto px-6 py-5">
          <Tabs defaultValue="primary" className="gap-4">
            <TabsList variant="line" className="w-full justify-start border-b border-border/70 px-0">
              <TabsTrigger value="primary">Primary</TabsTrigger>
              <TabsTrigger value="more">More</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              {!isBulk ? <TabsTrigger value="inventory">Inventory</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="primary" className="space-y-4 pt-1">
              <Section title="Core item fields" description="Merchandise-safe fields that already write through the current edit path.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={idFor("description")} label="Description">
                    <Input
                      id={idFor("description")}
                      value={form.description}
                      onChange={(event) => update("description", event.target.value)}
                      disabled={isBulk}
                      placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                    />
                  </Field>
                  <Field id={idFor("barcode")} label="Barcode">
                    <Input
                      id={idFor("barcode")}
                      value={form.barcode}
                      onChange={(event) => update("barcode", event.target.value)}
                      disabled={isBulk}
                      placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                    />
                  </Field>

                  <ItemRefSelectField
                    id={idFor("vendor")}
                    refs={refs}
                    kind="vendor"
                    label="Vendor"
                    value={form.vendorId}
                    onChange={(value) => update("vendorId", value)}
                    disabled={refsControlsDisabled}
                    bulkMode={isBulk}
                  />
                  <ItemRefSelectField
                    id={idFor("dcc")}
                    refs={refs}
                    kind="dcc"
                    label="Department / Class"
                    value={form.dccId}
                    onChange={(value) => update("dccId", value)}
                    disabled={refsControlsDisabled}
                    bulkMode={isBulk}
                  />
                  <ItemRefSelectField
                    id={idFor("taxType")}
                    refs={refs}
                    kind="taxType"
                    label="Tax Type"
                    value={form.itemTaxTypeId}
                    onChange={(value) => update("itemTaxTypeId", value)}
                    disabled={refsControlsDisabled}
                    bulkMode={isBulk}
                  />

                  <Field id={idFor("retail")} label="Retail">
                    <Input
                      id={idFor("retail")}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.retail}
                      onChange={(event) => update("retail", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("cost")} label="Cost">
                    <Input
                      id={idFor("cost")}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.cost}
                      onChange={(event) => update("cost", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("catalogNumber")} label="Catalog #">
                    <Input
                      id={idFor("catalogNumber")}
                      value={form.catalogNumber}
                      onChange={(event) => update("catalogNumber", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("comment")} label="Comment">
                    <Textarea
                      id={idFor("comment")}
                      value={form.comment}
                      onChange={(event) => update("comment", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                      className="min-h-24"
                    />
                  </Field>
                </div>

                <ReadOnlyCheckbox
                  checked={form.fDiscontinue}
                  label="Discontinue item"
                  onCheckedChange={(checked) => update("fDiscontinue", checked)}
                />
              </Section>
            </TabsContent>

            <TabsContent value="more" className="space-y-4 pt-1">
              <Section title="Packaging and merchandising" description="Writeable fields stay active. Phase 4 parity-only fields are surfaced read-only until their patch wiring lands.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ItemRefSelectField
                    id={idFor("packageType")}
                    refs={refs}
                    kind="packageType"
                    label="Package Type"
                    value={form.packageType}
                    onChange={(value) => update("packageType", value)}
                    disabled={refsControlsDisabled}
                    bulkMode={isBulk}
                  />
                  <Field id={idFor("unitsPerPack")} label="Units per Pack">
                    <Input
                      id={idFor("unitsPerPack")}
                      type="number"
                      min="1"
                      step="1"
                      value={form.unitsPerPack}
                      onChange={(event) => update("unitsPerPack", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("imageUrl")} label="Image URL">
                    <Input
                      id={idFor("imageUrl")}
                      value={form.imageUrl}
                      onChange={(event) => update("imageUrl", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("weight")} label="Weight">
                    <Input
                      id={idFor("weight")}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.weight}
                      onChange={(event) => update("weight", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>

                  <ItemRefSelectField
                    id={idFor("altVendor")}
                    refs={refs}
                    kind="vendor"
                    label="Alt Vendor"
                    value={form.altVendorId}
                    onChange={(value) => update("altVendorId", value)}
                    disabled
                  />
                  <ReadOnlyValueField id={idFor("manufacturer")} label="Manufacturer" value={form.mfgId} />
                  <ReadOnlyValueField id={idFor("size")} label="Size" value={form.size} />
                  <ItemRefSelectField
                    id={idFor("color")}
                    refs={refs}
                    kind="color"
                    label="Color"
                    value={form.colorId}
                    onChange={(value) => update("colorId", value)}
                    disabled
                  />
                  <ReadOnlyValueField id={idFor("style")} label="Style" value={form.styleId} />
                  <ReadOnlyValueField id={idFor("season")} label="Season" value={form.itemSeasonCodeId} />
                  <ReadOnlyValueField id={idFor("orderIncrement")} label="Order Increment" value={form.orderIncrement} />
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 pt-1">
              <Section title="Advanced flags" description="These rare item-level fields are visible now and remain read-only until the Phase 5 wiring pass.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <BooleanSelectField
                    id={idFor("listFlag")}
                    label="List Price Flag"
                    value={form.fListPriceFlag}
                    onChange={(value) => update("fListPriceFlag", value)}
                    disabled
                  />
                  <BooleanSelectField
                    id={idFor("perishable")}
                    label="Perishable"
                    value={form.fPerishable}
                    onChange={(value) => update("fPerishable", value)}
                    disabled
                  />
                  <BooleanSelectField
                    id={idFor("idRequired")}
                    label="ID Required"
                    value={form.fIdRequired}
                    onChange={(value) => update("fIdRequired", value)}
                    disabled
                  />
                  <ReadOnlyValueField id={idFor("minOrderQty")} label="Min Order Qty" value={form.minOrderQtyItem} />
                  <ItemRefSelectField
                    id={idFor("usedDcc")}
                    refs={refs}
                    kind="dcc"
                    label="Used DCC"
                    value={form.usedDccId}
                    onChange={(value) => update("usedDccId", value)}
                    disabled
                  />
                </div>
              </Section>
            </TabsContent>

            {!isBulk ? (
              <TabsContent value="inventory" className="space-y-4 pt-1">
                <Section
                  title={`Inventory · ${INVENTORY_LOCATION_LABELS[activeInventoryLocation]}`}
                  description="Edit the location-scoped inventory fields without affecting bulk edit or textbook surfaces."
                >
                  <div className="flex flex-wrap gap-2">
                    {INVENTORY_LOCATION_IDS.map((locationId) => (
                      <Button
                        key={locationId}
                        type="button"
                        size="sm"
                        variant={activeInventoryLocation === locationId ? "default" : "outline"}
                        aria-pressed={activeInventoryLocation === locationId}
                        onClick={() => setActiveInventoryLocation(locationId)}
                      >
                        {INVENTORY_LOCATION_LABELS[locationId]}
                      </Button>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReadOnlyValueField
                      id={idFor(`inventory-${activeInventoryLocation}-stock`)}
                      label="Stock on Hand"
                      value={activeInventory.stockOnHand || "—"}
                    />
                    <ReadOnlyValueField
                      id={idFor(`inventory-${activeInventoryLocation}-sale`)}
                      label="Last Sale"
                      value={activeInventory.lastSaleDate || "—"}
                    />
                    <Field id={idFor(`inventory-${activeInventoryLocation}-retail`)} label="Retail">
                      <Input
                        id={idFor(`inventory-${activeInventoryLocation}-retail`)}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={activeInventory.retail}
                        onChange={(event) => updateInventoryField(activeInventoryLocation, "retail", event.target.value)}
                      />
                    </Field>
                    <Field id={idFor(`inventory-${activeInventoryLocation}-cost`)} label="Cost">
                      <Input
                        id={idFor(`inventory-${activeInventoryLocation}-cost`)}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={activeInventory.cost}
                        onChange={(event) => updateInventoryField(activeInventoryLocation, "cost", event.target.value)}
                      />
                    </Field>
                    <Field id={idFor(`inventory-${activeInventoryLocation}-expected-cost`)} label="Expected Cost">
                      <Input
                        id={idFor(`inventory-${activeInventoryLocation}-expected-cost`)}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={activeInventory.expectedCost}
                        onChange={(event) => updateInventoryField(activeInventoryLocation, "expectedCost", event.target.value)}
                      />
                    </Field>
                    <ItemRefSelectField
                      id={idFor(`inventory-${activeInventoryLocation}-tag-type`)}
                      refs={refs}
                      kind="tagType"
                      label="Tag Type"
                      value={activeInventory.tagTypeId}
                      onChange={(value) => updateInventoryField(activeInventoryLocation, "tagTypeId", value)}
                      disabled={refsControlsDisabled}
                    />
                    <ItemRefSelectField
                      id={idFor(`inventory-${activeInventoryLocation}-status-code`)}
                      refs={refs}
                      kind="statusCode"
                      label="Status Code"
                      value={activeInventory.statusCodeId}
                      onChange={(value) => updateInventoryField(activeInventoryLocation, "statusCodeId", value)}
                      disabled={refsControlsDisabled}
                    />
                    <Field id={idFor(`inventory-${activeInventoryLocation}-est-sales`)} label="Est Sales">
                      <Input
                        id={idFor(`inventory-${activeInventoryLocation}-est-sales`)}
                        type="number"
                        step="1"
                        min="0"
                        value={activeInventory.estSales}
                        onChange={(event) => updateInventoryField(activeInventoryLocation, "estSales", event.target.value)}
                      />
                    </Field>
                    <BooleanSelectField
                      id={idFor(`inventory-${activeInventoryLocation}-est-sales-locked`)}
                      label="Est Sales Locked"
                      value={activeInventory.estSalesLocked}
                      onChange={(value) => updateInventoryField(activeInventoryLocation, "estSalesLocked", value)}
                    />
                    <BooleanSelectField
                      id={idFor(`inventory-${activeInventoryLocation}-inv-list-flag`)}
                      label="List Price Flag"
                      value={activeInventory.fInvListPriceFlag}
                      onChange={(value) => updateInventoryField(activeInventoryLocation, "fInvListPriceFlag", value)}
                    />
                    <BooleanSelectField
                      id={idFor(`inventory-${activeInventoryLocation}-tx-want-list-flag`)}
                      label="Want List Flag"
                      value={activeInventory.fTxWantListFlag}
                      onChange={(value) => updateInventoryField(activeInventoryLocation, "fTxWantListFlag", value)}
                    />
                    <BooleanSelectField
                      id={idFor(`inventory-${activeInventoryLocation}-tx-buyback-list-flag`)}
                      label="Buyback Flag"
                      value={activeInventory.fTxBuybackListFlag}
                      onChange={(value) => updateInventoryField(activeInventoryLocation, "fTxBuybackListFlag", value)}
                    />
                    <BooleanSelectField
                      id={idFor(`inventory-${activeInventoryLocation}-no-returns`)}
                      label="No Returns"
                      value={activeInventory.fNoReturns}
                      onChange={(value) => updateInventoryField(activeInventoryLocation, "fNoReturns", value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => copyInventoryField("retail")}>
                      Copy retail to other locations
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => copyInventoryField("cost")}>
                      Copy cost to other locations
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => copyInventoryField("tagTypeId")}>
                      Copy tag type to other locations
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => copyInventoryField("statusCodeId")}>
                      Copy status code to other locations
                    </Button>
                  </div>
                </Section>
              </TabsContent>
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
