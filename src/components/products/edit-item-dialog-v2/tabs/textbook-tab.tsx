"use client";

import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import type { ProductEditDetails } from "@/domains/product/types";
import { Section } from "../components/section";
import { Field, ReadOnlyValueField } from "../fields/field";
import type { FormState } from "../state/types";

/**
 * Textbook tab content — Imprint, Copyright, Text Status, Status Date, and
 * the read-only Book Key. Shown only for textbook rows. Phase 1 extraction.
 */
export function TextbookTabContent({
  form,
  update,
  idFor,
  isBulk,
  detail,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  idFor: (field: string) => string;
  isBulk: boolean;
  detail: ProductEditDetails | null;
}) {
  return (
    <TabsContent value="textbook" className="space-y-4 pt-1">
      <Section title="Textbook metadata" description="Lower-frequency textbook fields stay in their own tab.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={idFor("imprint")} label="Imprint">
            <Input
              id={idFor("imprint")}
              value={form.imprint}
              onChange={(event) => update("imprint", event.target.value)}
              placeholder={isBulk ? "Leave unchanged…" : ""}
            />
          </Field>
          <Field id={idFor("copyright")} label="Copyright">
            <Input
              id={idFor("copyright")}
              value={form.copyright}
              onChange={(event) => update("copyright", event.target.value)}
              placeholder={isBulk ? "Leave unchanged…" : ""}
            />
          </Field>
          <Field id={idFor("textStatusId")} label="Text Status">
            <Input
              id={idFor("textStatusId")}
              type="number"
              min="1"
              step="1"
              value={form.textStatusId}
              onChange={(event) => update("textStatusId", event.target.value)}
              placeholder={isBulk ? "Leave unchanged…" : ""}
            />
          </Field>
          <Field id={idFor("statusDate")} label="Status Date">
            <Input
              id={idFor("statusDate")}
              type="date"
              value={form.statusDate}
              onChange={(event) => update("statusDate", event.target.value)}
              placeholder={isBulk ? "Leave unchanged…" : ""}
            />
          </Field>
          <ReadOnlyValueField id={idFor("bookKey")} label="Book Key" value={detail?.bookKey ?? "—"} />
        </div>
      </Section>
    </TabsContent>
  );
}
