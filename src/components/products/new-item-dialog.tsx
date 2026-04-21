"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  DatabaseIcon,
  HashIcon,
  Loader2Icon,
  ArrowRightIcon,
  ChevronDownIcon,
  CopyIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  productApi,
  type CreatedItem,
} from "@/domains/product/api-client";
import {
  DEFAULT_PRODUCT_LOCATION_IDS,
  formatProductLocationList,
  getPrimaryProductLocationId,
  normalizeProductLocationIds,
  PRODUCT_LOCATION_ABBREV_BY_ID,
} from "@/domains/product/location-filters";
import { ItemRefSelectField } from "./item-ref-selects";
import { computeMargin } from "./batch-add-grid";
import { useProductRefDirectory } from "@/domains/product/vendor-directory";
import type { ProductLocationId } from "@/domains/product/types";

interface NewItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (item: CreatedItem) => void;
  locationIds?: ProductLocationId[];
  primaryLocationId?: ProductLocationId;
}

interface FormState {
  description: string;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  barcode: string;
  catalogNumber: string;
  comment: string;
  retail: string;
  cost: string;
}

interface LocationPricingState {
  retail: string;
  cost: string;
}

const EMPTY_FORM: FormState = {
  description: "",
  vendorId: "",
  dccId: "",
  itemTaxTypeId: "6",
  barcode: "",
  catalogNumber: "",
  comment: "",
  retail: "",
  cost: "",
};

const EMPTY_LOCATION_PRICING: LocationPricingState = {
  retail: "",
  cost: "",
};

const LOCATION_OPTIONS = [
  { id: 2 as const, abbrev: "PIER", label: "Pierce" },
  { id: 3 as const, abbrev: "PCOP", label: "PCOP" },
  { id: 4 as const, abbrev: "PFS", label: "PFS" },
];

const DEFAULT_LOCATION_PRICING: Record<ProductLocationId, LocationPricingState> = {
  2: { ...EMPTY_LOCATION_PRICING },
  3: { ...EMPTY_LOCATION_PRICING },
  4: { ...EMPTY_LOCATION_PRICING },
};

function buildSelectedLocations(locationIds: readonly ProductLocationId[]): Record<ProductLocationId, boolean> {
  const scopedLocationIds = normalizeProductLocationIds([2, ...locationIds]);
  return {
    2: scopedLocationIds.includes(2),
    3: scopedLocationIds.includes(3),
    4: scopedLocationIds.includes(4),
  };
}

// Keyed by MarginTone. Tailwind classes are statically written so the JIT
// picks them up.
const MARGIN_VALUE_CLASS = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-destructive",
  idle: "text-muted-foreground",
} as const;

const MARGIN_BG_CLASS = {
  good: "bg-emerald-500/5 border-emerald-500/30",
  warn: "bg-amber-500/5 border-amber-500/30",
  bad: "bg-destructive/5 border-destructive/30",
  idle: "bg-muted/40 border-border",
} as const;

const MARGIN_BAR_CLASS = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-destructive",
  idle: "bg-muted-foreground/40",
} as const;

const MARGIN_LABEL: Record<
  "good" | "warn" | "bad" | "idle",
  string | null
> = {
  good: "Healthy",
  warn: "Thin — review pricing",
  bad: "Underwater",
  idle: null,
};

export function NewItemDialog({
  open,
  onOpenChange,
  onCreated,
  locationIds = [...DEFAULT_PRODUCT_LOCATION_IDS],
  primaryLocationId,
}: NewItemDialogProps) {
  const { refs, loading: refsLoading, available: refsAvailable } = useProductRefDirectory();
  const locationScopeKey = locationIds.join(",");
  const resolvedLocationIds = useMemo(
    () =>
      normalizeProductLocationIds(
        locationScopeKey
          .split(",")
          .filter((value) => value.length > 0)
          .map((value) => Number(value)),
      ),
    [locationScopeKey],
  );
  const resolvedPrimaryLocationId = useMemo(
    () => primaryLocationId ?? getPrimaryProductLocationId(resolvedLocationIds),
    [primaryLocationId, resolvedLocationIds],
  );
  const scopedSelectedLocations = useMemo(
    () => buildSelectedLocations(resolvedLocationIds),
    [resolvedLocationIds],
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expanded, setExpanded] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<Record<ProductLocationId, boolean>>(
    scopedSelectedLocations,
  );
  const [locationPricing, setLocationPricing] = useState<
    Record<ProductLocationId, LocationPricingState>
  >(DEFAULT_LOCATION_PRICING);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createAnother, setCreateAnother] = useState(false);
  const descriptionRef = useRef<HTMLInputElement | null>(null);

  const refsUnavailable = !refsLoading && !refsAvailable;

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setExpanded(false);
      setSelectedLocations(scopedSelectedLocations);
      setLocationPricing(DEFAULT_LOCATION_PRICING);
      setError(null);
    }
  }, [open, scopedSelectedLocations]);

  const update = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateLocationPricing = useCallback(
    (
      locationId: ProductLocationId,
      field: keyof LocationPricingState,
      value: string,
    ) => {
      setLocationPricing((prev) => ({
        ...prev,
        [locationId]: {
          ...prev[locationId],
          [field]: value,
        },
      }));
    },
    [],
  );

  const toggleLocation = useCallback((locationId: ProductLocationId, checked: boolean) => {
    if (locationId === 2 && !checked) {
      return;
    }
    setSelectedLocations((prev) => ({
      ...prev,
      [locationId]: checked,
    }));
  }, []);

  const copyPierPricing = useCallback((locationId: ProductLocationId) => {
    setLocationPricing((prev) => ({
      ...prev,
      [locationId]: {
        retail: form.retail,
        cost: form.cost,
      },
    }));
  }, [form.cost, form.retail]);

  const selectedLocationIds = LOCATION_OPTIONS
    .filter((location) => selectedLocations[location.id])
    .map((location) => location.id);
  const hasSelectedLocation = selectedLocationIds.length > 0;
  const hasCanonicalPier = selectedLocations[2];
  const nonPierSelections = LOCATION_OPTIONS.filter(
    (location) => location.id !== 2 && selectedLocations[location.id],
  );
  const nonPierPricingValid = nonPierSelections.every((location) => {
    const pricing = locationPricing[location.id];
    return (
      pricing.retail !== "" &&
      pricing.cost !== "" &&
      Number(pricing.retail) >= 0 &&
      Number(pricing.cost) >= 0
    );
  });

  const formValid =
    form.description.trim().length > 0 &&
    form.vendorId !== "" &&
    form.dccId !== "" &&
    form.retail !== "" &&
    form.cost !== "" &&
    Number(form.retail) >= 0 &&
    Number(form.cost) >= 0 &&
    hasSelectedLocation &&
    hasCanonicalPier &&
    nonPierPricingValid;

  const submit = useCallback(async () => {
    if (!formValid || saving || !refs || refsLoading || refsUnavailable) return;
    setError(null);
    setSaving(true);
    try {
      const inventory = selectedLocationIds.map((locationId) => {
        if (locationId === 2) {
          return {
            locationId,
            retail: Number(form.retail),
            cost: Number(form.cost),
          };
        }
        return {
          locationId,
          retail: Number(locationPricing[locationId].retail),
          cost: Number(locationPricing[locationId].cost),
        };
      });
      const created = await productApi.create({
        description: form.description.trim(),
        vendorId: Number(form.vendorId),
        dccId: Number(form.dccId),
        itemTaxTypeId: form.itemTaxTypeId ? Number(form.itemTaxTypeId) : undefined,
        barcode: form.barcode.trim() || null,
        catalogNumber: form.catalogNumber.trim() || null,
        comment: form.comment.trim() || null,
        retail: Number(form.retail),
        cost: Number(form.cost),
        inventory,
      });
      onCreated?.(created);
      toast.success(`Created SKU ${created.sku}`, {
        description: createAnother
          ? "Form cleared · vendor, dept and tax kept"
          : undefined,
      });
      if (createAnother) {
        setForm((prev) => ({
          ...EMPTY_FORM,
          vendorId: prev.vendorId,
          dccId: prev.dccId,
          itemTaxTypeId: prev.itemTaxTypeId,
        }));
        setExpanded(false);
        setSelectedLocations(scopedSelectedLocations);
        setLocationPricing(DEFAULT_LOCATION_PRICING);
        requestAnimationFrame(() => descriptionRef.current?.focus());
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  }, [
    createAnother,
    form,
    formValid,
    locationPricing,
    onCreated,
    onOpenChange,
    refs,
    refsLoading,
    refsUnavailable,
    saving,
    selectedLocationIds,
    scopedSelectedLocations,
  ]);

  // ⌘/Ctrl+Enter submits from anywhere in the dialog
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submit]);

  const margin = computeMargin(form.cost, form.retail);
  const marginPctLabel = margin.pct === null ? "—" : `${margin.pct.toFixed(1)}%`;
  const marginHint = MARGIN_LABEL[margin.tone];

  // Simple deterministic SKU preview — for display only. The real SKU is
  // assigned by Prism on save.
  const skuPreview = previewSku(form.description, form.dccId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[55rem] md:max-w-4xl overflow-hidden">
        <DialogHeader className="border-b bg-muted/40 px-7 py-5">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Products · New item
            </span>
            <DialogTitle className="text-[1.35rem] font-bold tracking-tight leading-tight">
              New merchandise item
            </DialogTitle>
            <DialogDescription className="sr-only">
              Adds an item to the Pierce bookstore catalog. Writes directly to
              Prism and mirrors back to the LAPortal catalog.
            </DialogDescription>
          </div>
        </DialogHeader>

        {refsLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mx-7 mt-5 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <div className="flex items-center gap-2">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Loading vendors and categories…
            </div>
          </div>
        ) : null}
        {refsUnavailable ? (
          <div
            role="alert"
            aria-live="polite"
            className="mx-7 mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive"
          >
            Reference data is unavailable right now. You can still fill out the item details below, but vendor, department / class, and tax lookups are disabled until Prism recovers.
          </div>
        ) : null}
        <div className="grid max-h-[calc(92vh-11rem)] grid-cols-1 gap-7 overflow-y-auto px-7 py-5 md:grid-cols-[1fr_17rem]">
            {/* LEFT — form */}
            <div className="space-y-6">
              {/* Prism destination banner */}
              <div className="flex items-center gap-2.5 rounded-md border border-teal-500/25 bg-teal-500/5 px-3 py-2.5 text-xs">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300">
                  <DatabaseIcon className="size-3" aria-hidden />
                </span>
                <div className="leading-snug">
                  <span className="font-semibold text-foreground">
                    Writes to Prism.
                  </span>{" "}
                  <span className="text-muted-foreground">
                    New items appear in the Pierce POS within a minute and
                    mirror back into the LAPortal catalog.
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Primary location: {PRODUCT_LOCATION_ABBREV_BY_ID[resolvedPrimaryLocationId]}
                </span>{" "}
                <span>
                  · Current scope: {formatProductLocationList(resolvedLocationIds)} · New-item save writes the canonical PIER row and any scoped location rows selected below.
                </span>
              </div>

              {/* Identity */}
              <section aria-labelledby="new-item-identity" className="space-y-3">
                <SectionHeading id="new-item-identity">Identity</SectionHeading>
                <div className="space-y-1.5">
                  <Label htmlFor="description">
                    Description <Required />
                  </Label>
                  <Input
                    id="description"
                    name="description"
                    autoComplete="off"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    maxLength={128}
                    placeholder="PIERCE LOGO MUG 12OZ"
                    autoFocus
                    ref={descriptionRef}
                    className="h-11 text-[15px] font-medium"
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Shown on receipts and at the POS. Keep it terse.</span>
                    <span className="tabular-nums">
                      {form.description.length}/128
                    </span>
                  </div>
                </div>
              </section>

              {/* Classification */}
              <section
                aria-labelledby="new-item-classification"
                className="space-y-3"
              >
                <SectionHeading id="new-item-classification">
                  Classification
                </SectionHeading>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ItemRefSelectField
                    id="vendor-select"
                    refs={refs}
                    kind="vendor"
                    value={form.vendorId}
                    disabled={refsLoading || refsUnavailable}
                    onChange={(value) => update("vendorId", value)}
                  />
                  <ItemRefSelectField
                    id="dcc-select"
                    refs={refs}
                    kind="dcc"
                    value={form.dccId}
                    disabled={refsLoading || refsUnavailable}
                    onChange={(value) => update("dccId", value)}
                  />
                </div>
              </section>

              {/* Pricing */}
              <section aria-labelledby="new-item-pricing" className="space-y-3">
                <SectionHeading id="new-item-pricing">Pricing</SectionHeading>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MoneyField
                    id="retail"
                    label="Retail"
                    required
                    value={form.retail}
                    onChange={(v) => update("retail", v)}
                  />
                  <MoneyField
                    id="cost"
                    label="Cost"
                    required
                    value={form.cost}
                    onChange={(v) => update("cost", v)}
                  />
                </div>
              </section>

              <section aria-labelledby="new-item-locations" className="space-y-3">
                <SectionHeading
                  id="new-item-locations"
                  hint="PIER defaults on. Select at least one location."
                >
                  Locations
                </SectionHeading>
                <div className="grid gap-3 sm:grid-cols-3">
                  {LOCATION_OPTIONS.map((location) => (
                    <label
                      key={location.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border px-3 py-3 text-sm",
                        selectedLocations[location.id]
                          ? "border-foreground/20 bg-muted/40"
                          : "border-border bg-background",
                      )}
                    >
                      <Checkbox
                        checked={selectedLocations[location.id]}
                        disabled={location.id === 2}
                        onCheckedChange={(checked) =>
                          toggleLocation(location.id, checked === true)
                        }
                        aria-label={location.abbrev}
                        className="mt-0.5"
                      />
                      <span className="leading-tight">
                        <span className="block font-medium">{location.abbrev}</span>
                        <span className="text-xs text-muted-foreground">
                          {location.label}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {!hasSelectedLocation ? (
                  <p className="text-xs text-destructive">
                    Select at least one location before creating the item.
                  </p>
                ) : null}
                {!hasCanonicalPier ? (
                  <p className="text-xs text-destructive">
                    PIER is required because the create flow mirrors Pierce pricing
                    into the canonical product row.
                  </p>
                ) : null}

                {nonPierSelections.length > 0 ? (
                  <div className="space-y-3">
                    {nonPierSelections.map((location) => (
                      <div
                        key={location.id}
                        className="rounded-lg border border-border/80 bg-muted/20 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">
                              {location.abbrev} pricing
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Retail and cost for this location only.
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyPierPricing(location.id)}
                          >
                            <CopyIcon aria-hidden />
                            {`Copy from PIER to ${location.abbrev}`}
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <MoneyField
                            id={`${location.abbrev.toLowerCase()}-retail`}
                            label={`${location.abbrev} Retail`}
                            required
                            value={locationPricing[location.id].retail}
                            onChange={(value) =>
                              updateLocationPricing(location.id, "retail", value)
                            }
                          />
                          <MoneyField
                            id={`${location.abbrev.toLowerCase()}-cost`}
                            label={`${location.abbrev} Cost`}
                            required
                            value={locationPricing[location.id].cost}
                            onChange={(value) =>
                              updateLocationPricing(location.id, "cost", value)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section aria-labelledby="new-item-optional" className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border/80 px-3 py-2 text-left"
                  aria-expanded={expanded}
                  aria-controls="new-item-optional-fields"
                  onClick={() => setExpanded((prev) => !prev)}
                >
                  <span>
                    <span className="block text-sm font-medium">More fields</span>
                    <span className="text-xs text-muted-foreground">
                      Barcode, tax type, catalog number, and internal note.
                    </span>
                  </span>
                  <ChevronDownIcon
                    aria-hidden
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      expanded ? "rotate-180" : "rotate-0",
                    )}
                  />
                </button>

                {expanded ? (
                  <div id="new-item-optional-fields" className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="barcode">
                          Barcode <OptionalHint />
                        </Label>
                        <Input
                          id="barcode"
                          name="barcode"
                          autoComplete="off"
                          spellCheck={false}
                          value={form.barcode}
                          onChange={(e) => update("barcode", e.target.value)}
                          maxLength={20}
                          placeholder="UPC / EAN"
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="catalogNumber">
                          Catalog # <OptionalHint />
                        </Label>
                        <Input
                          id="catalogNumber"
                          name="catalogNumber"
                          autoComplete="off"
                          spellCheck={false}
                          value={form.catalogNumber}
                          onChange={(e) => update("catalogNumber", e.target.value)}
                          maxLength={30}
                          placeholder="Vendor part #"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <ItemRefSelectField
                          id="taxTypeExpanded"
                          refs={refs}
                          kind="taxType"
                          value={form.itemTaxTypeId}
                          disabled={refsLoading || refsUnavailable}
                          label="Tax Type"
                          onChange={(value) => update("itemTaxTypeId", value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="comment">
                          Internal note{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            (max 25 chars, staff only)
                          </span>
                        </Label>
                        <Input
                          id="comment"
                          name="comment"
                          autoComplete="off"
                          value={form.comment}
                          onChange={(e) => update("comment", e.target.value)}
                          maxLength={25}
                          placeholder="e.g. fall run, reorder"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              {error ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}
            </div>

            {/* RIGHT — summary rail */}
            <aside className="hidden self-start border-l pl-6 md:block">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Preview
              </div>

              {/* SKU card */}
              <SummaryCard>
                <CardLabel icon={<HashIcon className="size-3" aria-hidden />}>
                  SKU
                </CardLabel>
                <div
                  key={skuPreview ?? "empty"}
                  className={cn(
                    "mt-1 font-mono text-[22px] font-semibold tracking-tight tabular-nums animate-in fade-in-0 slide-in-from-bottom-0.5",
                    skuPreview ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {skuPreview ?? "— — — —"}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {skuPreview
                    ? "Preview — confirmed on save"
                    : "After description + dept / class"}
                </p>
              </SummaryCard>

              {/* Margin card */}
              <SummaryCard
                className={cn("mt-3 border", MARGIN_BG_CLASS[margin.tone])}
              >
                <CardLabel>Margin</CardLabel>
                <div
                  className={cn(
                    "mt-1 text-[26px] font-bold leading-none tracking-tight tabular-nums",
                    MARGIN_VALUE_CLASS[margin.tone],
                  )}
                  aria-live="polite"
                >
                  {marginPctLabel}
                </div>
                {margin.pct !== null && marginHint ? (
                  <>
                    <div
                      className={cn(
                        "mt-1 text-xs font-medium",
                        MARGIN_VALUE_CLASS[margin.tone],
                      )}
                    >
                      {marginHint}
                    </div>
                    <div className="relative mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-200",
                          MARGIN_BAR_CLASS[margin.tone],
                        )}
                        style={{
                          width: `${Math.max(2, Math.min(100, margin.pct))}%`,
                        }}
                      />
                      <div
                        aria-hidden
                        className="absolute top-[-2px] h-2 w-px bg-muted-foreground/40"
                        style={{ left: "30%" }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                      <span>0%</span>
                      <span>30%</span>
                      <span>100%</span>
                    </div>
                  </>
                ) : null}
              </SummaryCard>

              {/* Destination card */}
              <SummaryCard className="mt-3 border border-teal-500/25 bg-teal-500/5">
                <CardLabel icon={<DatabaseIcon className="size-3" aria-hidden />}>
                  Destination
                </CardLabel>
                <div className="mt-1 text-sm font-semibold">Prism POS</div>
                <div className="text-[11px] leading-snug text-muted-foreground">
                  Mirrors to LAPortal catalog within a minute.
                </div>
              </SummaryCard>

              <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
                <span>to create</span>
              </div>
            </aside>
          </div>

        <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/40 px-7 py-3.5 sm:justify-between">
          <label className="flex cursor-pointer select-none items-start gap-2.5">
            <Checkbox
              checked={createAnother}
              onCheckedChange={(v) => setCreateAnother(v === true)}
              className="mt-0.5"
              aria-label="Create another after this"
            />
            <span className="text-sm leading-tight">
              Create another after this
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Keeps vendor, dept / class and tax.
              </span>
            </span>
          </label>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={!formValid || saving || !refs || refsLoading || refsUnavailable}
              data-icon="inline-end"
            >
              {saving ? (
                <>
                  <Loader2Icon className="animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                <>
                  Create item
                  <ArrowRightIcon aria-hidden />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */

function SectionHeading({
  id,
  children,
  hint,
}: {
  id: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
      <h3
        id={id}
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        {children}
      </h3>
      {hint ? (
        <span className="text-[11px] text-muted-foreground/75">{hint}</span>
      ) : null}
    </div>
  );
}

function Required() {
  return (
    <span className="text-destructive" aria-label="required">
      *
    </span>
  );
}

function OptionalHint() {
  return (
    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
  );
}

function SummaryCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 p-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardLabel({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1.5 py-px font-mono text-[10px]">
      {children}
    </kbd>
  );
}

interface MoneyFieldProps {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}

function MoneyField({ id, label, required, value, onChange }: MoneyFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <>
            {" "}
            <Required />
          </>
        ) : null}
      </Label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          aria-hidden
        >
          $
        </span>
        <Input
          id={id}
          name={id}
          autoComplete="off"
          inputMode="decimal"
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="pl-6 text-right font-mono tabular-nums"
        />
      </div>
    </div>
  );
}

/**
 * Deterministic display-only SKU preview. The authoritative SKU is returned
 * by Prism on save; this just gives users a sense that an identifier will be
 * formed from their input.
 */
function previewSku(description: string, dccId: string): string | null {
  const d = description.trim();
  if (!d || !dccId) return null;
  let hash = 7;
  for (let i = 0; i < d.length; i++) {
    hash = (hash * 31 + d.charCodeAt(i)) >>> 0;
  }
  const suffix = (hash % 9000) + 1000;
  const dept = dccId.slice(-3);
  return `${dept}-${suffix}`;
}
