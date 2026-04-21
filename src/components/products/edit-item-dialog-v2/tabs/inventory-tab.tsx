"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import type { PrismRefs } from "@/domains/product/api-client";
import { ItemRefSelectField } from "../../item-ref-selects";
import { Section } from "../components/section";
import { BooleanSelectField } from "../fields/boolean-select";
import { Field, ReadOnlyValueField } from "../fields/field";
import type {
  InventoryFormState,
  InventoryLocationId,
} from "../state/types";
import { INVENTORY_LOCATION_IDS, INVENTORY_LOCATION_LABELS } from "../state/types";

/**
 * Inventory tab content. Hidden in bulk mode. Carries the PIER/PCOP/PFS
 * location picker, the per-location editable fields, and the copy-to-other
 * affordances. Phase 1 extraction preserves behavior exactly.
 */
export function InventoryTabContent({
  activeInventory,
  activeInventoryLocation,
  setActiveInventoryLocation,
  updateInventoryField,
  copyInventoryField,
  idFor,
  refs,
  refsControlsDisabled,
}: {
  activeInventory: InventoryFormState;
  activeInventoryLocation: InventoryLocationId;
  setActiveInventoryLocation: (locationId: InventoryLocationId) => void;
  updateInventoryField: <K extends keyof InventoryFormState>(
    locationId: InventoryLocationId,
    key: K,
    value: InventoryFormState[K],
  ) => void;
  copyInventoryField: (field: "retail" | "cost" | "tagTypeId" | "statusCodeId") => void;
  idFor: (field: string) => string;
  refs: PrismRefs | null;
  refsControlsDisabled: boolean;
}) {
  return (
    <TabsContent value="inventory" className="space-y-4 pt-1">
      <Section
        title={`Inventory · ${INVENTORY_LOCATION_LABELS[activeInventoryLocation]}`}
        description="Edit the location-scoped inventory fields without affecting bulk edit or textbook surfaces."
      >
        <div className="flex flex-wrap gap-2">
          {INVENTORY_LOCATION_IDS.map((locationId) => (
            <Button
              key={locationId}
              type="button"
              size="sm"
              variant={activeInventoryLocation === locationId ? "default" : "outline"}
              aria-pressed={activeInventoryLocation === locationId}
              onClick={() => setActiveInventoryLocation(locationId)}
            >
              {INVENTORY_LOCATION_LABELS[locationId]}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyValueField
            id={idFor(`inventory-${activeInventoryLocation}-stock`)}
            label="Stock on Hand"
            value={activeInventory.stockOnHand || "—"}
          />
          <ReadOnlyValueField
            id={idFor(`inventory-${activeInventoryLocation}-sale`)}
            label="Last Sale"
            value={activeInventory.lastSaleDate || "—"}
          />
          <Field id={idFor(`inventory-${activeInventoryLocation}-retail`)} label="Retail">
            <Input
              id={idFor(`inventory-${activeInventoryLocation}-retail`)}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={activeInventory.retail}
              onChange={(event) => updateInventoryField(activeInventoryLocation, "retail", event.target.value)}
            />
          </Field>
          <Field id={idFor(`inventory-${activeInventoryLocation}-cost`)} label="Cost">
            <Input
              id={idFor(`inventory-${activeInventoryLocation}-cost`)}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={activeInventory.cost}
              onChange={(event) => updateInventoryField(activeInventoryLocation, "cost", event.target.value)}
            />
          </Field>
          <Field id={idFor(`inventory-${activeInventoryLocation}-expected-cost`)} label="Expected Cost">
            <Input
              id={idFor(`inventory-${activeInventoryLocation}-expected-cost`)}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={activeInventory.expectedCost}
              onChange={(event) => updateInventoryField(activeInventoryLocation, "expectedCost", event.target.value)}
            />
          </Field>
          <ItemRefSelectField
            id={idFor(`inventory-${activeInventoryLocation}-tag-type`)}
            refs={refs}
            kind="tagType"
            label="Tag Type"
            value={activeInventory.tagTypeId}
            onChange={(value) => updateInventoryField(activeInventoryLocation, "tagTypeId", value)}
            disabled={refsControlsDisabled}
            allowClear
          />
          <ItemRefSelectField
            id={idFor(`inventory-${activeInventoryLocation}-status-code`)}
            refs={refs}
            kind="statusCode"
            label="Status Code"
            value={activeInventory.statusCodeId}
            onChange={(value) => updateInventoryField(activeInventoryLocation, "statusCodeId", value)}
            disabled={refsControlsDisabled}
            allowClear
          />
          <Field id={idFor(`inventory-${activeInventoryLocation}-est-sales`)} label="Est Sales">
            <Input
              id={idFor(`inventory-${activeInventoryLocation}-est-sales`)}
              type="number"
              step="1"
              min="0"
              value={activeInventory.estSales}
              onChange={(event) => updateInventoryField(activeInventoryLocation, "estSales", event.target.value)}
            />
          </Field>
          <BooleanSelectField
            id={idFor(`inventory-${activeInventoryLocation}-est-sales-locked`)}
            label="Est Sales Locked"
            value={activeInventory.estSalesLocked}
            onChange={(value) => updateInventoryField(activeInventoryLocation, "estSalesLocked", value)}
          />
          <BooleanSelectField
            id={idFor(`inventory-${activeInventoryLocation}-inv-list-flag`)}
            label="List Price Flag"
            value={activeInventory.fInvListPriceFlag}
            onChange={(value) => updateInventoryField(activeInventoryLocation, "fInvListPriceFlag", value)}
          />
          <BooleanSelectField
            id={idFor(`inventory-${activeInventoryLocation}-tx-want-list-flag`)}
            label="Want List Flag"
            value={activeInventory.fTxWantListFlag}
            onChange={(value) => updateInventoryField(activeInventoryLocation, "fTxWantListFlag", value)}
          />
          <BooleanSelectField
            id={idFor(`inventory-${activeInventoryLocation}-tx-buyback-list-flag`)}
            label="Buyback Flag"
            value={activeInventory.fTxBuybackListFlag}
            onChange={(value) => updateInventoryField(activeInventoryLocation, "fTxBuybackListFlag", value)}
          />
          <BooleanSelectField
            id={idFor(`inventory-${activeInventoryLocation}-no-returns`)}
            label="No Returns"
            value={activeInventory.fNoReturns}
            onChange={(value) => updateInventoryField(activeInventoryLocation, "fNoReturns", value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => copyInventoryField("retail")}>
            Copy retail to other locations
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => copyInventoryField("cost")}>
            Copy cost to other locations
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => copyInventoryField("tagTypeId")}>
            Copy tag type to other locations
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => copyInventoryField("statusCodeId")}>
            Copy status code to other locations
          </Button>
        </div>
      </Section>
    </TabsContent>
  );
}
