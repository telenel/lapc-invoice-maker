"use client";

import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PrismRefs } from "@/domains/product/api-client";
import { ItemRefSelectField } from "../../item-ref-selects";
import { Section } from "../components/section";
import { BindingSelectField } from "../fields/binding-select";
import { Field, ReadOnlyCheckbox } from "../fields/field";
import type { FormState, InventoryLocationId } from "../state/types";
import { INVENTORY_LOCATION_LABELS } from "../state/types";

/**
 * Primary tab content for `EditItemDialogV2`. Carries ~10 core editable
 * fields (GM variant) or bibliographic fields (textbook variant), plus the
 * retail/cost pair (primary location), catalog / comment, and the
 * discontinue checkbox. Phase 1 extraction preserves behavior exactly.
 */
export function PrimaryTabContent({
  form,
  update,
  idFor,
  isBulk,
  isTextbookRow,
  refs,
  refsControlsDisabled,
  resolvedPrimaryLocationId,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  idFor: (field: string) => string;
  isBulk: boolean;
  isTextbookRow: boolean;
  refs: PrismRefs | null;
  refsControlsDisabled: boolean;
  resolvedPrimaryLocationId: InventoryLocationId;
}) {
  return (
    <TabsContent value="primary" className="space-y-4 pt-1">
      <Section
        title={isTextbookRow ? "Textbook item fields" : "Core item fields"}
        description={
          isTextbookRow
            ? "Textbook rows keep the high-frequency bibliographic fields up front."
            : "Merchandise-safe fields that already write through the current edit path."
        }
      >
        {!isBulk && !isTextbookRow ? (
          <p className="text-sm text-muted-foreground">
            Retail and cost in this tab write to the current primary page location: {INVENTORY_LOCATION_LABELS[resolvedPrimaryLocationId]}.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {isTextbookRow ? (
            <>
              <Field id={idFor("title")} label="Title">
                <Input
                  id={idFor("title")}
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                />
              </Field>
              <Field id={idFor("author")} label="Author">
                <Input
                  id={idFor("author")}
                  value={form.author}
                  onChange={(event) => update("author", event.target.value)}
                  placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                />
              </Field>
              <Field id={idFor("isbn")} label="ISBN">
                <Input
                  id={idFor("isbn")}
                  value={form.isbn}
                  onChange={(event) => update("isbn", event.target.value)}
                  placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                />
              </Field>
              <Field id={idFor("edition")} label="Edition">
                <Input
                  id={idFor("edition")}
                  value={form.edition}
                  onChange={(event) => update("edition", event.target.value)}
                  placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                />
              </Field>
              <BindingSelectField
                id={idFor("binding")}
                label="Binding"
                value={form.bindingId}
                onChange={(value) => update("bindingId", value === "__clear__" ? "" : value)}
                disabled={refsControlsDisabled}
                refs={refs}
                isBulk={isBulk}
              />
              <Field id={idFor("barcode")} label="Barcode">
                <Input
                  id={idFor("barcode")}
                  value={form.barcode}
                  onChange={(event) => update("barcode", event.target.value)}
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
            </>
          ) : (
            <>
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
            </>
          )}

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
          {isTextbookRow ? null : (
            <>
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
            </>
          )}
        </div>

        <ReadOnlyCheckbox
          checked={form.fDiscontinue}
          label="Discontinue item"
          onCheckedChange={(checked) => update("fDiscontinue", checked)}
        />
      </Section>
    </TabsContent>
  );
}
