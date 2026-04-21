"use client";

import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import type { PrismRefs } from "@/domains/product/api-client";
import { ItemRefSelectField } from "../../item-ref-selects";
import { Section } from "../components/section";
import { BooleanSelectField } from "../fields/boolean-select";
import { Field } from "../fields/field";
import type { FormState } from "../state/types";

/**
 * "Advanced" tab content — rare item-level flags (List Price Flag, Perishable,
 * ID Required), Min Order Qty, and Used DCC. Phase 1 extraction.
 */
export function AdvancedTabContent({
  form,
  update,
  idFor,
  isBulk,
  refs,
  refsControlsDisabled,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  idFor: (field: string) => string;
  isBulk: boolean;
  refs: PrismRefs | null;
  refsControlsDisabled: boolean;
}) {
  return (
    <TabsContent value="advanced" className="space-y-4 pt-1">
      <Section
        title="Advanced flags"
        description="Rare item-level controls — apply to all locations."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <BooleanSelectField
            id={idFor("listFlag")}
            label="List Price Flag"
            value={form.fListPriceFlag}
            onChange={(value) => update("fListPriceFlag", value)}
          />
          <BooleanSelectField
            id={idFor("perishable")}
            label="Perishable"
            value={form.fPerishable}
            onChange={(value) => update("fPerishable", value)}
          />
          <BooleanSelectField
            id={idFor("idRequired")}
            label="ID Required"
            value={form.fIdRequired}
            onChange={(value) => update("fIdRequired", value)}
          />
          <Field id={idFor("minOrderQty")} label="Min Order Qty">
            <Input
              id={idFor("minOrderQty")}
              type="number"
              min="1"
              step="1"
              value={form.minOrderQtyItem}
              onChange={(event) => update("minOrderQtyItem", event.target.value)}
              placeholder={isBulk ? "Leave unchanged…" : ""}
            />
          </Field>
          <ItemRefSelectField
            id={idFor("usedDcc")}
            refs={refs}
            kind="dcc"
            label="Used DCC"
            value={form.usedDccId}
            onChange={(value) => update("usedDccId", value)}
            disabled={refsControlsDisabled}
            bulkMode={isBulk}
          />
        </div>
      </Section>
    </TabsContent>
  );
}
