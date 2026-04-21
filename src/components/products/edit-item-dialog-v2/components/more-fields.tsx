"use client";

import { Input } from "@/components/ui/input";
import type { PrismRefs } from "@/domains/product/api-client";
import { ItemRefSelectField } from "../../item-ref-selects";
import { Field } from "../fields/field";
import type { FormState } from "../state/types";

/**
 * "More" fields block — packaging, merchandising, alternate vendor,
 * manufacturer, style, color, season, order increment. Phase 2 renders
 * these inside an in-place `<Accordion>` inside the Primary tab; the
 * historical `MoreTabContent` (TabsContent wrapper) was removed along with
 * its dedicated tab.
 */
export function MoreFields({
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
        disabled={refsControlsDisabled}
        bulkMode={isBulk}
      />
      <Field id={idFor("manufacturer")} label="Manufacturer ID">
        <Input
          id={idFor("manufacturer")}
          type="number"
          min="1"
          step="1"
          value={form.mfgId}
          onChange={(event) => update("mfgId", event.target.value)}
          placeholder={isBulk ? "Leave unchanged…" : ""}
        />
      </Field>
      <Field id={idFor("size")} label="Size">
        <Input
          id={idFor("size")}
          value={form.size}
          onChange={(event) => update("size", event.target.value)}
          placeholder={isBulk ? "Leave unchanged…" : ""}
        />
      </Field>
      <ItemRefSelectField
        id={idFor("color")}
        refs={refs}
        kind="color"
        label="Color"
        value={form.colorId}
        onChange={(value) => update("colorId", value)}
        disabled={refsControlsDisabled}
        bulkMode={isBulk}
      />
      <Field id={idFor("style")} label="Style ID">
        <Input
          id={idFor("style")}
          type="number"
          min="1"
          step="1"
          value={form.styleId}
          onChange={(event) => update("styleId", event.target.value)}
          placeholder={isBulk ? "Leave unchanged…" : ""}
        />
      </Field>
      <Field id={idFor("season")} label="Season Code">
        <Input
          id={idFor("season")}
          type="number"
          min="1"
          step="1"
          value={form.itemSeasonCodeId}
          onChange={(event) => update("itemSeasonCodeId", event.target.value)}
          placeholder={isBulk ? "Leave unchanged…" : ""}
        />
      </Field>
      <Field id={idFor("orderIncrement")} label="Order Increment">
        <Input
          id={idFor("orderIncrement")}
          type="number"
          min="1"
          step="1"
          value={form.orderIncrement}
          onChange={(event) => update("orderIncrement", event.target.value)}
          placeholder={isBulk ? "Leave unchanged…" : ""}
        />
      </Field>
    </div>
  );
}
