"use client";

import { Input } from "@/components/ui/input";
import type { PrismRefs } from "@/domains/product/api-client";
import { ItemRefSelectField } from "../../item-ref-selects";
import { BooleanSelectField } from "../fields/boolean-select";
import { Field } from "../fields/field";
import type { FormState } from "../state/types";

/**
 * "Advanced" fields block — rare item-level flags and overrides. Phase 2
 * renders these inside an in-place `<Accordion>` inside the Primary tab.
 */
export function AdvancedFields({
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
  );
}
