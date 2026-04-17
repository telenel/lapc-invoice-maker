"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemRefSelects } from "@/components/products/item-ref-selects";
import { productApi, type PrismRefs } from "@/domains/product/api-client";
import type { BulkEditTransform, PricingMode } from "@/domains/bulk-edit/types";

interface TransformPanelProps {
  transform: BulkEditTransform;
  onChange: (next: BulkEditTransform) => void;
  onPreview: () => void;
  previewing: boolean;
  disabled: boolean;
}

type PricingModeKey = PricingMode["mode"];

export function TransformPanel({ transform, onChange, onPreview, previewing, disabled }: TransformPanelProps) {
  const [refs, setRefs] = useState<PrismRefs | null>(null);

  useEffect(() => {
    productApi.refs().then(setRefs).catch(() => {});
  }, []);

  const mode = transform.pricing.mode;

  function setMode(next: PricingModeKey) {
    let pricing: PricingMode;
    switch (next) {
      case "none": pricing = { mode: "none" }; break;
      case "uplift": pricing = { mode: "uplift", percent: 0 }; break;
      case "absolute": pricing = { mode: "absolute", retail: 0 }; break;
      case "margin": pricing = { mode: "margin", targetMargin: 0.4 }; break;
      case "cost":
        pricing = {
          mode: "cost",
          newCost: { kind: "absolute", value: 0 },
          preserveMargin: true,
        };
        break;
    }
    onChange({ ...transform, pricing });
  }

  return (
    <section aria-labelledby="transform-heading" className="space-y-3 rounded border p-4">
      <h2 id="transform-heading" className="text-base font-semibold">2. Transform</h2>

      <div className="rounded border border-blue-200/50 bg-blue-50/30 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
        <h3 className="text-sm font-medium">Pierce Pricing</h3>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          {(["none", "uplift", "absolute", "margin", "cost"] as PricingModeKey[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pricing-mode"
                value={k}
                checked={mode === k}
                onChange={() => setMode(k)}
                disabled={disabled}
              />
              <span>{labelFor(k)}</span>
            </label>
          ))}
        </div>

        <PricingControls transform={transform} onChange={onChange} disabled={disabled} />
      </div>

      <div className="rounded border border-destructive/30 bg-destructive/5 p-3">
        <h3 className="text-sm font-medium">District-wide Catalog <span className="font-normal text-muted-foreground">- affects all 17 LACCD locations</span></h3>
        <p className="mt-1 text-xs text-muted-foreground">Leave a field empty to skip that change.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ItemRefSelects
            refs={refs}
            vendorId=""
            dccId={transform.catalog.dccId !== undefined ? String(transform.catalog.dccId) : ""}
            itemTaxTypeId={transform.catalog.itemTaxTypeId !== undefined ? String(transform.catalog.itemTaxTypeId) : ""}
            onChange={(field, value) => {
              if (field === "vendorId") return;
              onChange({
                ...transform,
                catalog: {
                  ...transform.catalog,
                  [field]: value ? Number(value) : undefined,
                },
              });
            }}
            bulkMode
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onPreview} disabled={previewing || disabled}>
          {previewing ? "Building preview..." : "Preview ->"}
        </Button>
      </div>
    </section>
  );
}

function labelFor(k: PricingModeKey): string {
  switch (k) {
    case "none": return "No change";
    case "uplift": return "Uplift %";
    case "absolute": return "Absolute set";
    case "margin": return "Margin re-price";
    case "cost": return "Cost update";
  }
}

function PricingControls({ transform, onChange, disabled }: { transform: BulkEditTransform; onChange: (t: BulkEditTransform) => void; disabled: boolean }) {
  const p = transform.pricing;

  if (p.mode === "none") return null;

  if (p.mode === "uplift") {
    return (
      <div className="mt-3 flex items-center gap-3">
        <Label htmlFor="uplift-percent" className="whitespace-nowrap">Percent (+/-):</Label>
        <Input
          id="uplift-percent"
          type="number"
          step="0.1"
          autoComplete="off"
          className="w-32 tabular-nums"
          value={p.percent}
          disabled={disabled}
          onChange={(e) => onChange({ ...transform, pricing: { mode: "uplift", percent: Number(e.target.value) } })}
        />
        <span className="text-sm text-muted-foreground">e.g. 5 for +5%, -10 for -10%</span>
      </div>
    );
  }

  if (p.mode === "absolute") {
    return (
      <div className="mt-3 flex items-center gap-3">
        <Label htmlFor="abs-retail" className="whitespace-nowrap">Set retail to:</Label>
        <Input
          id="abs-retail"
          type="number"
          step="0.01"
          min="0"
          autoComplete="off"
          className="w-32 tabular-nums"
          value={p.retail}
          disabled={disabled}
          onChange={(e) => onChange({ ...transform, pricing: { mode: "absolute", retail: Number(e.target.value) } })}
        />
      </div>
    );
  }

  if (p.mode === "margin") {
    return (
      <div className="mt-3 flex items-center gap-3">
        <Label htmlFor="margin-target" className="whitespace-nowrap">Target margin:</Label>
        <Input
          id="margin-target"
          type="number"
          step="0.01"
          min="0"
          max="0.99"
          autoComplete="off"
          className="w-32 tabular-nums"
          value={p.targetMargin}
          disabled={disabled}
          onChange={(e) => onChange({ ...transform, pricing: { mode: "margin", targetMargin: Number(e.target.value) } })}
        />
        <span className="text-sm text-muted-foreground">0.40 = 40% (retail = cost / (1 - margin))</span>
      </div>
    );
  }

  const costP = p;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="cost-kind"
            checked={costP.newCost.kind === "absolute"}
            onChange={() =>
              onChange({ ...transform, pricing: { mode: "cost", newCost: { kind: "absolute", value: 0 }, preserveMargin: costP.preserveMargin } })
            }
            disabled={disabled}
          />
          <span>Set cost to</span>
        </Label>
        <Label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="cost-kind"
            checked={costP.newCost.kind === "uplift"}
            onChange={() =>
              onChange({ ...transform, pricing: { mode: "cost", newCost: { kind: "uplift", percent: 0 }, preserveMargin: costP.preserveMargin } })
            }
            disabled={disabled}
          />
          <span>Uplift cost by %</span>
        </Label>
      </div>
      <div className="flex items-center gap-3">
        <Input
          type="number"
          step="0.01"
          min="0"
          autoComplete="off"
          className="w-32 tabular-nums"
          value={costP.newCost.kind === "absolute" ? costP.newCost.value : costP.newCost.percent}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value);
            const newCost: PricingMode = costP.newCost.kind === "absolute"
              ? { mode: "cost", newCost: { kind: "absolute", value: v }, preserveMargin: costP.preserveMargin }
              : { mode: "cost", newCost: { kind: "uplift", percent: v }, preserveMargin: costP.preserveMargin };
            onChange({ ...transform, pricing: newCost });
          }}
        />
      </div>
      <Label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={costP.preserveMargin}
          onChange={(e) =>
            onChange({
              ...transform,
              pricing: { mode: "cost", newCost: costP.newCost, preserveMargin: e.target.checked },
            })
          }
          disabled={disabled}
        />
        <span>Recompute retail to preserve current margin per item</span>
      </Label>
    </div>
  );
}
