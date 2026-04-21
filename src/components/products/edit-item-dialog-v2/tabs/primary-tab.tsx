"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PrismRefs } from "@/domains/product/api-client";
import { ItemRefSelectField } from "../../item-ref-selects";
import { AdvancedFields } from "../components/advanced-fields";
import { MoreFields } from "../components/more-fields";
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
  mixedBulkSelection = null,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  idFor: (field: string) => string;
  isBulk: boolean;
  isTextbookRow: boolean;
  refs: PrismRefs | null;
  refsControlsDisabled: boolean;
  resolvedPrimaryLocationId: InventoryLocationId;
  mixedBulkSelection?: { textbookCount: number; gmCount: number } | null;
}) {
  const primaryLocationLabel = INVENTORY_LOCATION_LABELS[resolvedPrimaryLocationId];
  return (
    <TabsContent value="primary" className="space-y-4 pt-1">
      {mixedBulkSelection ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <span className="font-medium">Mixed selection</span> — {mixedBulkSelection.textbookCount} textbook
          {mixedBulkSelection.textbookCount === 1 ? "" : "s"} and {mixedBulkSelection.gmCount} merchandise item
          {mixedBulkSelection.gmCount === 1 ? "" : "s"}. Textbook-specific fields are hidden; edit textbooks individually to change title, author, ISBN, edition, or binding.
        </div>
      ) : null}
      <Section
        title={isTextbookRow ? "Textbook item fields" : "Core item fields"}
        description={
          isTextbookRow
            ? "Textbook rows keep the high-frequency bibliographic fields up front."
            : "Merchandise-safe fields that already write through the current edit path."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isTextbookRow ? (
            <>
              <div className="col-span-full">
                <Field id={idFor("title")} label="Title">
                  <Input
                    id={idFor("title")}
                    value={form.title}
                    onChange={(event) => update("title", event.target.value)}
                    placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                  />
                </Field>
              </div>
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
                  className="font-mono text-xs"
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
                unavailableHint="Vendor labels unavailable — connect to Prism."
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
                unavailableHint="Department labels unavailable — connect to Prism."
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
                unavailableHint="Tax type labels unavailable — connect to Prism."
              />
            </>
          ) : (
            <>
              {/* Per spec: Description → Vendor → DCC → Tax Type → Barcode → (Retail/Cost later). */}
              <div className="col-span-full">
                <Field id={idFor("description")} label="Description">
                  <Input
                    id={idFor("description")}
                    value={form.description}
                    onChange={(event) => update("description", event.target.value)}
                    disabled={isBulk}
                    placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                  />
                </Field>
              </div>
              <ItemRefSelectField
                id={idFor("vendor")}
                refs={refs}
                kind="vendor"
                label="Vendor"
                value={form.vendorId}
                onChange={(value) => update("vendorId", value)}
                disabled={refsControlsDisabled}
                bulkMode={isBulk}
                unavailableHint="Vendor labels unavailable — connect to Prism."
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
                unavailableHint="Department labels unavailable — connect to Prism."
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
                unavailableHint="Tax type labels unavailable — connect to Prism."
              />
              <Field id={idFor("barcode")} label="Barcode">
                <Input
                  id={idFor("barcode")}
                  value={form.barcode}
                  onChange={(event) => update("barcode", event.target.value)}
                  disabled={isBulk}
                  placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                  className="font-mono text-xs"
                />
              </Field>
            </>
          )}

          <Field id={idFor("retail")} label={isBulk ? "Retail" : `Retail (${primaryLocationLabel})`}>
            <Input
              id={idFor("retail")}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.retail}
              onChange={(event) => update("retail", event.target.value)}
              placeholder={isBulk ? "Leave unchanged…" : ""}
              className="tabular-nums"
            />
          </Field>
          <Field id={idFor("cost")} label={isBulk ? "Cost" : `Cost (${primaryLocationLabel})`}>
            <Input
              id={idFor("cost")}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.cost}
              onChange={(event) => update("cost", event.target.value)}
              placeholder={isBulk ? "Leave unchanged…" : ""}
              className="tabular-nums"
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
              <div className="col-span-full">
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
            </>
          )}
        </div>

        <ReadOnlyCheckbox
          checked={form.fDiscontinue}
          label="Discontinue item"
          onCheckedChange={(checked) => update("fDiscontinue", checked)}
        />
      </Section>

      <Accordion className="rounded-xl border border-border/60 bg-background/50 px-4">
        <AccordionItem value="more">
          <AccordionTrigger>More — packaging, size, color, weight</AccordionTrigger>
          <AccordionContent>
            <MoreFields
              form={form}
              update={update}
              idFor={idFor}
              isBulk={isBulk}
              refs={refs}
              refsControlsDisabled={refsControlsDisabled}
            />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="advanced">
          <AccordionTrigger>Advanced — rare flags and overrides</AccordionTrigger>
          <AccordionContent>
            <AdvancedFields
              form={form}
              update={update}
              idFor={idFor}
              isBulk={isBulk}
              refs={refs}
              refsControlsDisabled={refsControlsDisabled}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </TabsContent>
  );
}
