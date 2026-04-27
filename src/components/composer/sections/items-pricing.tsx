"use client";

import { SearchIcon } from "lucide-react";
import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { LineItemsTable } from "./line-items-table";
import { MarginCard } from "./margin-card";
import { TaxCard } from "./tax-card";
import { DensityToggle } from "../primitives/density-toggle";
import { useDensity } from "../hooks/use-density";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  composer: ReturnType<typeof useInvoiceForm> | ReturnType<typeof useQuoteForm>;
  sectionStatus: "default" | "complete" | "blocker";
  onOpenCatalog: (categoryFilter?: string) => void;
  showCateringPreset?: boolean;
}

// Bridge type: the union of invoice/quote hook returns makes `updateField`'s
// generic key parameter resolve to `never`, so the call is "not callable" until
// we cast through a concrete writer shape. The keys here are constrained to the
// 2 fields this section writes so typos fail at compile time. Both forms expose
// these fields with the same primitive types — runtime-safe.
type ItemsFieldKey = "marginEnabled" | "taxEnabled" | "marginPercent" | "taxRate";
type FieldWriter = {
  updateField: (key: ItemsFieldKey, value: boolean | number) => void;
};

// ---------------------------------------------------------------------------
// ItemsAndPricingSection
// ---------------------------------------------------------------------------

export function ItemsAndPricingSection({
  composer,
  sectionStatus,
  onOpenCatalog,
  showCateringPreset,
}: Props) {
  const f = composer.form;
  const { density, setDensity } = useDensity();
  const taxableCount = f.items.filter((i) => i.isTaxable).length;
  const write = (composer as unknown as FieldWriter).updateField;

  return (
    <SectionCard
      step={4}
      title="Items & Pricing"
      anchor="section-items"
      status={sectionStatus}
      action={<DensityToggle value={density} onChange={setDensity} />}
    >
      <LineItemsTable
        items={f.items}
        marginEnabled={f.marginEnabled}
        taxEnabled={f.taxEnabled}
        marginPercent={f.marginPercent}
        density={density}
        onUpdate={(idx, patch) => composer.updateItem(idx, patch as never)}
        onRemove={(idx) => composer.removeItem(idx)}
      />

      <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 rounded-b-lg border border-t-0 border-border-strong bg-muted px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onOpenCatalog()} className="gap-1.5">
            <SearchIcon className="size-3.5" /> Search Product Catalog
          </Button>
          <Button variant="outline" onClick={() => composer.addItem()}>
            Add custom line
          </Button>
          {showCateringPreset && (
            <Button variant="ghost" onClick={() => onOpenCatalog("Catering")}>
              Catering preset
            </Button>
          )}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          <kbd className="rounded border border-border bg-background px-1 py-0.5">Tab</kbd>{" "}
          next field
          <span className="mx-1">·</span>
          <kbd className="rounded border border-border bg-background px-1 py-0.5">Enter</kbd>{" "}
          add row
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
        <MarginCard
          enabled={f.marginEnabled}
          percent={f.marginPercent}
          onEnabledChange={(v) => write("marginEnabled", v)}
          onPercentChange={(v) => write("marginPercent", v)}
        />
        <TaxCard
          enabled={f.taxEnabled}
          rate={f.taxRate}
          taxableCount={taxableCount}
          onEnabledChange={(v) => write("taxEnabled", v)}
          onRateChange={(v) => write("taxRate", v)}
        />
      </div>
    </SectionCard>
  );
}
