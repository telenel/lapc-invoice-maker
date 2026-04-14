"use client";

import { useState, useTransition } from "react";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { printPricingApi } from "@/domains/print-pricing/api-client";
import type { PrintPricingSnapshot, QuantityTier, FixedTier } from "@/domains/print-pricing/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface QuantityTierFormState {
  variant: string;
  label: string;
  description: string;
  minQuantity: string;
  maxQuantity: string;
  unitPrice: string;
}

interface FixedTierFormState {
  variant: string;
  label: string;
  description: string;
  unitPrice: string;
}

interface PricingAdminPanelProps {
  initialPricing: PrintPricingSnapshot;
}

interface PricingFormState {
  shopTitle: string;
  quotePrefix: string;
  quoteDisclaimer: string;
  taxEnabled: boolean;
  taxRate: string;
  bwDuplexMultiplier: string;
  colorDuplexMultiplier: string;
  minimumScanCharge: string;
  copyTiers: {
    BW: QuantityTierFormState[];
    COLOR: QuantityTierFormState[];
  };
  scanTiers: QuantityTierFormState[];
  posterTiers: Record<"LOW" | "MEDIUM" | "HIGH", FixedTierFormState>;
  bindingTiers: Record<"COMB" | "GLUE", FixedTierFormState>;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function basisPointsToPercentInput(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2);
}

function basisPointsToMultiplierInput(basisPoints: number): string {
  return (basisPoints / 10_000).toFixed(2);
}

function quantityTierToFormState(tier: QuantityTier): QuantityTierFormState {
  return {
    variant: tier.variant,
    label: tier.label,
    description: tier.description,
    minQuantity: String(tier.minQuantity),
    maxQuantity: tier.maxQuantity === null ? "" : String(tier.maxQuantity),
    unitPrice: centsToInput(tier.unitPriceCents),
  };
}

function fixedTierToFormState(tier: FixedTier): FixedTierFormState {
  return {
    variant: tier.variant,
    label: tier.label,
    description: tier.description,
    unitPrice: centsToInput(tier.unitPriceCents),
  };
}

function createFormState(pricing: PrintPricingSnapshot): PricingFormState {
  return {
    shopTitle: pricing.shopTitle,
    quotePrefix: pricing.quotePrefix,
    quoteDisclaimer: pricing.quoteDisclaimer,
    taxEnabled: pricing.taxEnabled,
    taxRate: basisPointsToPercentInput(pricing.taxRateBasisPoints),
    bwDuplexMultiplier: basisPointsToMultiplierInput(pricing.bwDuplexMultiplierBasisPoints),
    colorDuplexMultiplier: basisPointsToMultiplierInput(pricing.colorDuplexMultiplierBasisPoints),
    minimumScanCharge: centsToInput(pricing.minimumScanChargeCents),
    copyTiers: {
      BW: pricing.copyTiers.BW.map(quantityTierToFormState),
      COLOR: pricing.copyTiers.COLOR.map(quantityTierToFormState),
    },
    scanTiers: pricing.scanTiers.map(quantityTierToFormState),
    posterTiers: {
      LOW: fixedTierToFormState(pricing.posterTiers.LOW),
      MEDIUM: fixedTierToFormState(pricing.posterTiers.MEDIUM),
      HIGH: fixedTierToFormState(pricing.posterTiers.HIGH),
    },
    bindingTiers: {
      COMB: fixedTierToFormState(pricing.bindingTiers.COMB),
      GLUE: fixedTierToFormState(pricing.bindingTiers.GLUE),
    },
  };
}

function parseCurrencyInput(value: string, label: string): number {
  const normalized = Number.parseFloat(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return Math.round(normalized * 100);
}

function parsePercentToBasisPoints(value: string, label: string): number {
  const normalized = Number.parseFloat(value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }

  return Math.round(normalized * 100);
}

function parseMultiplierToBasisPoints(value: string, label: string): number {
  const normalized = Number.parseFloat(value);
  if (!Number.isFinite(normalized) || normalized < 1) {
    throw new Error(`${label} must be 1.00 or greater.`);
  }

  return Math.round(normalized * 10_000);
}

function parseInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${label} must be a whole number.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return parsed;
}

function emptyQuantityTier(variant: string): QuantityTierFormState {
  return {
    variant,
    label: "",
    description: "",
    minQuantity: "",
    maxQuantity: "",
    unitPrice: "",
  };
}

function TierTable({
  title,
  description,
  rows,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  rows: QuantityTierFormState[];
  onChange: (index: number, key: keyof QuantityTierFormState, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <PlusIcon className="mr-2 size-4" />
          Add tier
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${title}-${index}`} className="rounded-xl border border-border/80 p-4">
            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={row.label} onChange={(event) => onChange(index, "label", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Min qty</Label>
                <Input value={row.minQuantity} onChange={(event) => onChange(index, "minQuantity", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Max qty</Label>
                <Input value={row.maxQuantity} onChange={(event) => onChange(index, "maxQuantity", event.target.value)} placeholder="Open ended" />
              </div>
              <div className="space-y-2">
                <Label>Unit price</Label>
                <Input value={row.unitPrice} onChange={(event) => onChange(index, "unitPrice", event.target.value)} placeholder="0.00" />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="icon-sm" onClick={() => onRemove(index)} disabled={rows.length === 1}>
                  <Trash2Icon className="size-4" />
                  <span className="sr-only">Remove tier</span>
                </Button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label>Description</Label>
              <Input value={row.description} onChange={(event) => onChange(index, "description", event.target.value)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FixedTierGrid({
  title,
  description,
  tiers,
  onChange,
}: {
  title: string;
  description: string;
  tiers: Record<string, FixedTierFormState>;
  onChange: (key: string, field: keyof FixedTierFormState, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(tiers).map(([key, tier]) => (
          <div key={key} className="rounded-xl border border-border/80 p-4 space-y-3">
            <div className="space-y-2">
              <Label>{key} label</Label>
              <Input value={tier.label} onChange={(event) => onChange(key, "label", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{key} price</Label>
              <Input value={tier.unitPrice} onChange={(event) => onChange(key, "unitPrice", event.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>{key} description</Label>
              <Textarea value={tier.description} onChange={(event) => onChange(key, "description", event.target.value)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingAdminPanel({ initialPricing }: PricingAdminPanelProps) {
  const [form, setForm] = useState<PricingFormState>(() => createFormState(initialPricing));
  const [isPending, startTransition] = useTransition();

  function setQuantityTier(
    collection: "BW" | "COLOR" | "SCAN",
    index: number,
    key: keyof QuantityTierFormState,
    value: string
  ) {
    setForm((current) => {
      if (collection === "SCAN") {
        const nextRows = [...current.scanTiers];
        nextRows[index] = { ...nextRows[index], [key]: value };
        return { ...current, scanTiers: nextRows };
      }

      const nextRows = [...current.copyTiers[collection]];
      nextRows[index] = { ...nextRows[index], [key]: value };
      return {
        ...current,
        copyTiers: {
          ...current.copyTiers,
          [collection]: nextRows,
        },
      };
    });
  }

  function addQuantityTier(collection: "BW" | "COLOR" | "SCAN") {
    setForm((current) => {
      if (collection === "SCAN") {
        return { ...current, scanTiers: [...current.scanTiers, emptyQuantityTier("SCAN")] };
      }

      return {
        ...current,
        copyTiers: {
          ...current.copyTiers,
          [collection]: [...current.copyTiers[collection], emptyQuantityTier(collection)],
        },
      };
    });
  }

  function removeQuantityTier(collection: "BW" | "COLOR" | "SCAN", index: number) {
    setForm((current) => {
      if (collection === "SCAN") {
        return { ...current, scanTiers: current.scanTiers.filter((_, rowIndex) => rowIndex !== index) };
      }

      return {
        ...current,
        copyTiers: {
          ...current.copyTiers,
          [collection]: current.copyTiers[collection].filter((_, rowIndex) => rowIndex !== index),
        },
      };
    });
  }

function setFixedTier(
    collection: "posterTiers" | "bindingTiers",
    key: string,
    field: keyof FixedTierFormState,
    value: string
  ) {
    setForm((current) => {
      if (collection === "posterTiers") {
        const tierKey = key as keyof PricingFormState["posterTiers"];
        return {
          ...current,
          posterTiers: {
            ...current.posterTiers,
            [tierKey]: {
              ...current.posterTiers[tierKey],
              [field]: value,
            },
          },
        };
      }

      const tierKey = key as keyof PricingFormState["bindingTiers"];
      return {
        ...current,
        bindingTiers: {
          ...current.bindingTiers,
          [tierKey]: {
            ...current.bindingTiers[tierKey],
            [field]: value,
          },
        },
      };
    });
  }

  function buildPayload() {
    const mapQuantityTiers = (rows: QuantityTierFormState[], label: string) =>
      rows.map((row, index) => ({
        variant: row.variant,
        label: row.label.trim(),
        description: row.description.trim(),
        minQuantity: parseInteger(row.minQuantity, `${label} tier ${index + 1} minimum quantity`),
        maxQuantity: row.maxQuantity.trim() === "" ? null : parseInteger(row.maxQuantity, `${label} tier ${index + 1} maximum quantity`),
        unitPriceCents: parseCurrencyInput(row.unitPrice, `${label} tier ${index + 1} unit price`),
        sortOrder: index,
      }));

    const mapFixedTier = (row: FixedTierFormState, label: string, sortOrder: number) => ({
      variant: row.variant,
      label: row.label.trim(),
      description: row.description.trim(),
      unitPriceCents: parseCurrencyInput(row.unitPrice, `${label} price`),
      sortOrder,
    });

    return {
      shopTitle: form.shopTitle.trim(),
      quotePrefix: form.quotePrefix.trim().toUpperCase(),
      quoteDisclaimer: form.quoteDisclaimer.trim(),
      taxEnabled: form.taxEnabled,
      taxRateBasisPoints: parsePercentToBasisPoints(form.taxRate, "Tax rate"),
      bwDuplexMultiplierBasisPoints: parseMultiplierToBasisPoints(form.bwDuplexMultiplier, "B&W duplex multiplier"),
      colorDuplexMultiplierBasisPoints: parseMultiplierToBasisPoints(form.colorDuplexMultiplier, "Color duplex multiplier"),
      minimumScanChargeCents: parseCurrencyInput(form.minimumScanCharge, "Minimum scan charge"),
      copyTiers: {
        BW: mapQuantityTiers(form.copyTiers.BW, "B&W"),
        COLOR: mapQuantityTiers(form.copyTiers.COLOR, "Color"),
      },
      scanTiers: mapQuantityTiers(form.scanTiers, "Scanning"),
      posterTiers: {
        LOW: mapFixedTier(form.posterTiers.LOW, "Low poster", 0),
        MEDIUM: mapFixedTier(form.posterTiers.MEDIUM, "Medium poster", 1),
        HIGH: mapFixedTier(form.posterTiers.HIGH, "High poster", 2),
      },
      bindingTiers: {
        COMB: mapFixedTier(form.bindingTiers.COMB, "Comb binding", 0),
        GLUE: mapFixedTier(form.bindingTiers.GLUE, "Glue binding", 1),
      },
    };
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const payload = buildPayload();
        const updated = await printPricingApi.updatePricingConfig(payload);
        setForm(createFormState(updated));
        toast.success("Pricing settings saved.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save pricing settings.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Print pricing settings</h1>
          <p className="text-sm text-muted-foreground">
            Update public calculator rates, duplex pricing, tax settings, and the default quote disclaimer.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <SaveIcon className="mr-2 size-4" />
          {isPending ? "Saving..." : "Save pricing"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quote settings</CardTitle>
          <CardDescription>These values appear in the calculator experience and generated PDF quotes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="shop-title">Shop title</Label>
            <Input id="shop-title" value={form.shopTitle} onChange={(event) => setForm((current) => ({ ...current, shopTitle: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-prefix">Quote prefix</Label>
            <Input id="quote-prefix" value={form.quotePrefix} onChange={(event) => setForm((current) => ({ ...current, quotePrefix: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax rate (%)</Label>
            <Input id="tax-rate" value={form.taxRate} onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimum-scan-charge">Minimum scan charge</Label>
            <Input id="minimum-scan-charge" value={form.minimumScanCharge} onChange={(event) => setForm((current) => ({ ...current, minimumScanCharge: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bw-duplex-multiplier">B&amp;W duplex multiplier</Label>
            <Input id="bw-duplex-multiplier" value={form.bwDuplexMultiplier} onChange={(event) => setForm((current) => ({ ...current, bwDuplexMultiplier: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color-duplex-multiplier">Color duplex multiplier</Label>
            <Input id="color-duplex-multiplier" value={form.colorDuplexMultiplier} onChange={(event) => setForm((current) => ({ ...current, colorDuplexMultiplier: event.target.value }))} />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-border/80 px-4 py-3 text-sm font-medium md:col-span-2">
            <input
              type="checkbox"
              checked={form.taxEnabled}
              onChange={(event) => setForm((current) => ({ ...current, taxEnabled: event.target.checked }))}
            />
            Enable sales tax on generated print quotes
          </label>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="quote-disclaimer">Quote disclaimer</Label>
            <Textarea id="quote-disclaimer" value={form.quoteDisclaimer} onChange={(event) => setForm((current) => ({ ...current, quoteDisclaimer: event.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Copy pricing</CardTitle>
          <CardDescription>Edit tiered pricing for black-and-white and color copy jobs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <TierTable
            title="B&W copies"
            description="Single-sided base pricing for 24 lb copy paper."
            rows={form.copyTiers.BW}
            onChange={(index, key, value) => setQuantityTier("BW", index, key, value)}
            onAdd={() => addQuantityTier("BW")}
            onRemove={(index) => removeQuantityTier("BW", index)}
          />

          <TierTable
            title="Color copies"
            description="Single-sided base pricing for 24 lb copy paper."
            rows={form.copyTiers.COLOR}
            onChange={(index, key, value) => setQuantityTier("COLOR", index, key, value)}
            onAdd={() => addQuantityTier("COLOR")}
            onRemove={(index) => removeQuantityTier("COLOR", index)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Poster and binding pricing</CardTitle>
          <CardDescription>Keep labels editable so customer-facing wording can evolve without code changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <FixedTierGrid
            title='24" x 36" poster saturation levels'
            description="These labels and descriptions appear on the public calculator."
            tiers={form.posterTiers}
            onChange={(key, field, value) => setFixedTier("posterTiers", key, field, value)}
          />

          <FixedTierGrid
            title="Binding prices"
            description="Flat pricing applied per finished bound item."
            tiers={form.bindingTiers}
            onChange={(key, field, value) => setFixedTier("bindingTiers", key, field, value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scanning pricing</CardTitle>
          <CardDescription>Tiered per-page rates with a separate minimum charge configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          <TierTable
            title="Scanning tiers"
            description="Per-page scanning rates by page-count tier."
            rows={form.scanTiers}
            onChange={(index, key, value) => setQuantityTier("SCAN", index, key, value)}
            onAdd={() => addQuantityTier("SCAN")}
            onRemove={(index) => removeQuantityTier("SCAN", index)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
